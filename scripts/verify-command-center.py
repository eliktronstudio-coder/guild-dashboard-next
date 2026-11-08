"""Real production HTTP and Chromium checks using a disposable database. Never touches production."""
from pathlib import Path
import http.client
import json
import os
import secrets
import socket
import sqlite3
import shutil
import subprocess
import tempfile
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path(os.environ.get('XD_REVIEW_ARTIFACTS', '/workspace/xd-review-artifacts'))
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def main():
    with tempfile.TemporaryDirectory(prefix='xd-review-') as temporary:
        database = Path(temporary) / 'test.db'
        sqlite3.connect(database).close()
        env = {**os.environ, 'DATABASE_URL': 'file:' + str(database), 'SESSION_SECRET': secrets.token_hex(32), 'XD_REVIEW_PASSWORD': secrets.token_urlsafe(24)}
        subprocess.run(['npx','prisma','migrate','deploy'],cwd=ROOT,env=env,check=True,capture_output=True)
        result = subprocess.run(['npx','tsx','scripts/create-review-fixture.ts'],cwd=ROOT,env=env,check=True,capture_output=True,text=True)
        fixture = json.loads(result.stdout.strip().splitlines()[-1])
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0)); port = sock.getsockname()[1]
        origin = f'http://127.0.0.1:{port}'
        with tempfile.TemporaryFile() as log:
            server = subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',str(port)],cwd=ROOT,env=env,stdout=log,stderr=log)
            def request(path, method='GET', body=None, cookie=None, headers=None):
                connection = http.client.HTTPConnection('127.0.0.1',port,timeout=30)
                outgoing = {'Content-Type':'application/json', **(headers or {})}
                if cookie: outgoing['Cookie'] = cookie
                connection.request(method,path,json.dumps(body) if body is not None else None,outgoing)
                response = connection.getresponse(); content = response.read(); status = response.status; response_headers = dict(response.getheaders()); connection.close()
                return status, content, response_headers
            try:
                for _ in range(100):
                    if server.poll() is not None: raise AssertionError('Production server exited')
                    try:
                        if request('/access')[0] == 200: break
                    except (ConnectionError,OSError): pass
                    time.sleep(0.2)
                else: raise AssertionError('Production server did not become ready')
                cookies = {}
                for role in ['admin','member','rl','random']:
                    status,content,headers = request('/api/auth/login','POST',{'username':'review_'+role,'password':env['XD_REVIEW_PASSWORD']})
                    assert status == 200, (role,status)
                    cookie = headers.get('set-cookie','')
                    assert 'Secure' in cookie and 'HttpOnly' in cookie and 'SameSite=lax' in cookie
                    cookies[role] = cookie.split(';')[0]
                marker = 'Проверка приватности'.encode()
                for role in [None,'random']:
                    cookie = cookies.get(role)
                    for path in ['/','/dashboard','/statistics','/players','/activities','/treasury','/payments','/players/'+fixture['playerId']]:
                        status,content,_ = request(path,cookie=cookie)
                        assert marker not in content, (role,path,'private data leaked')
                        if path != '/':
                            assert status in [200,307,308] and b'/access' in content, (role,path,status)
                            _,rsc,_ = request(path,cookie=cookie,headers={'RSC':'1'})
                            assert marker not in rsc, (role,path,'private RSC data leaked')
                    assert request('/api/players/'+fixture['playerId'],cookie=cookie)[0] == 403
                    assert request('/api/statistics/export',cookie=cookie)[0] == 403
                    assert request('/api/treasury/export',cookie=cookie)[0] == 403
                print('PASS: anonymous/random page, RSC payload and API access denied before private data is serialized')
                status,content,_ = request('/api/statistics/export?period=current',cookie=cookies['admin'])
                assert status == 200 and b"'password" not in content and b'passwordHash' not in content
                assert b"'=1+1" in content
                assert request('/api/statistics/export?period=custom&from=2026-02-30&to=2026-03-01',cookie=cookies['admin'])[0] == 400
                print('PASS: date validation and CSV formula protection through the real export endpoint')
                assert request('/api/drops/sell','POST',{},cookies['rl'])[0] == 403
                assert request('/api/activities','POST',{'name':'PvP','drops':[{'catalogItemId':fixture['catalogId'],'quantity':1}]},cookies['rl'])[0] == 403
                sale = {'entryIds':[fixture['dropId']],'quantity':1,'amount':1000}
                status,first,_ = request('/api/drops/sell','POST',sale,cookies['admin'],{'Idempotency-Key':'review-sale-0000000001'})
                assert status == 200, first
                status,repeated,_ = request('/api/drops/sell','POST',sale,cookies['admin'],{'Idempotency-Key':'review-sale-0000000001'})
                assert status == 200 and json.loads(repeated)['repeated']
                with sqlite3.connect(database) as db:
                    assert db.execute('select quantity from DropItem where id=?',(fixture['dropId'],)).fetchone()[0] == 2
                print('PASS: RL financial permissions; HTTP sale retry deducts inventory exactly once')
                status,body,_ = request('/api/activities','POST',{'name':'АГЛ','date':time.strftime('%Y-%m-%d'),'participantIds':[fixture['playerId'],fixture['playerId']]},cookies['rl'])
                assert status == 201,body
                created = json.loads(body)
                assert created['bossKillConfirmed'] is False
                assert request('/api/activities/'+fixture['activityId'],'DELETE',cookie=cookies['rl'])[0] == 409
                assert request('/api/players/'+fixture['playerId'],'DELETE',cookie=cookies['admin'])[0] == 409
                print('PASS: activity creation deduplicates roster, never infers a boss kill, and dependent history cannot be deleted')
                assert request('/api/activities/'+fixture['archivedActivityId'],'PATCH',{'name':'Недопустимо'},cookies['rl'])[0] == 409
                assert request('/api/activities/'+fixture['archivedActivityId']+'/guests','POST',{'name':'Новый'},cookies['rl'])[0] == 409
                payout_input = {'playerId':fixture['memberPlayerId'],'category':'Прайм'}
                assert request('/api/payments/payout','POST',payout_input,cookies['member'])[0] == 403
                before_other = json.loads(request('/api/players/'+fixture['playerId'],cookie=cookies['admin'])[1])['player']['salaryPrime']
                status,payout_body,_ = request('/api/payments/payout','POST',payout_input,cookies['admin'])
                assert status == 200,payout_body
                assert request('/api/payments/payout','POST',payout_input,cookies['admin'])[0] == 409
                after_other = json.loads(request('/api/players/'+fixture['playerId'],cookie=cookies['admin'])[1])['player']['salaryPrime']
                assert before_other == after_other
                assert request('/api/payments/payout','DELETE',payout_input,cookies['admin'])[0] == 200
                print('PASS: HTTP payout cannot repeat or change another player share; cancellation succeeds')
                status,ledger_export,_ = request('/api/treasury/export',cookie=cookies['member'])
                assert status == 200 and 'Выплата ЗП'.encode() not in ledger_export
                assert request('/api/treasury/export?ledgerFrom=2026-02-30',cookie=cookies['admin'])[0] == 400
                original_id = json.loads(first)['transactionId']
                assert request('/api/treasury/transactions/'+original_id,'DELETE',cookie=cookies['admin'])[0] == 200
                assert request('/api/treasury/transactions/'+original_id,'DELETE',cookie=cookies['admin'])[0] == 200
                with sqlite3.connect(database) as db:
                    assert db.execute('select amount from TreasuryTransaction where id=?',(original_id,)).fetchone()[0] == 1000
                    assert db.execute('select count(*) from TreasuryTransaction where reversalOfId=?',(original_id,)).fetchone()[0] == 1
                print('PASS: archived activity mutations denied; cancellation retains original transaction and compensates only once')
                with sync_playwright() as playwright:
                    browser = playwright.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
                    context = browser.new_context(reduced_motion='reduce',locale='ru-RU',color_scheme='dark')
                    context.add_cookies([{'name':'session','value':cookies['admin'].split('=',1)[1],'url':origin}])
                    page = context.new_page()
                    errors = []; page.on('pageerror',lambda error: errors.append(str(error)))
                    page.on('console',lambda message: errors.append(message.text) if message.type == 'error' and ('hydration' in message.text.lower() or 'minified react error' in message.text.lower()) else None)
                    pages = ['/dashboard','/statistics','/activities','/players','/treasury','/payments']
                    for width in [360,390,768,1024,1440,1920]:
                        page.set_viewport_size({'width':width,'height':1000})
                        for path in pages:
                            response = page.goto(origin+path,wait_until='networkidle')
                            assert response and response.status == 200,(path,width)
                            assert page.locator('body').inner_text().find('Не удалось загрузить данные') == -1,(path,width)
                            overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                            assert not overflow,(path,width,'horizontal overflow')
                            if (width,path) in [(1440,'/dashboard'),(1440,'/statistics'),(360,'/players')]: page.screenshot(path=str(ARTIFACTS/f'{path[1:]}-{width}.png'),full_page=True)
                    page.goto(origin+'/statistics',wait_until='networkidle')
                    page.get_by_label('Поиск игрока').fill('Игрок 35'); page.get_by_role('button',name='Применить',exact=True).click(); page.wait_for_load_state('networkidle')
                    assert page.locator('tbody tr').count() == 1
                    page.goto(origin+'/players',wait_until='networkidle')
                    page.get_by_label('Игровой ник',exact=True).fill('Игрок 35'); page.get_by_role('button',name='Применить',exact=True).click(); page.wait_for_load_state('networkidle')
                    assert 'Игрок 35' in page.locator('main').inner_text()
                    page.goto(origin+'/dashboard',wait_until='networkidle')
                    page.get_by_role('button',name='Настроить',exact=True).click()
                    page.get_by_label('Видимость панелей').get_by_label('Динамика казны',exact=True).uncheck()
                    assert page.locator('[data-panel-id="treasury-chart"]').count() == 0
                    page.reload(wait_until='networkidle'); page.get_by_role('button',name='Настроить',exact=True).click()
                    assert not page.get_by_label('Видимость панелей').get_by_label('Динамика казны',exact=True).is_checked()
                    page.get_by_role('button',name='Сбросить',exact=True).click()
                    assert page.locator('[data-panel-id="treasury-chart"]').count() == 1
                    page.get_by_role('button',name='Включить светлую тему',exact=True).click()
                    page.screenshot(path=str(ARTIFACTS/'dashboard-light.png'),full_page=True)
                    for width in [360,390,768,1024,1440,1920]:
                        page.set_viewport_size({'width':width,'height':1000})
                        for path in pages:
                            page.goto(origin+path,wait_until='networkidle')
                            assert page.evaluate("document.documentElement.getAttribute('data-theme') === 'light'")
                            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'),(path,width,'light overflow')
                    assert not errors,errors[:3]
                    browser.close()
                print('PASS: six widths × six sections × two themes; real filters; persisted dashboard visibility/reset; light theme; no page errors or overflow')
            finally:
                server.terminate()
                try: server.wait(timeout=10)
                except subprocess.TimeoutExpired: server.kill(); server.wait()


if __name__ == '__main__': main()
