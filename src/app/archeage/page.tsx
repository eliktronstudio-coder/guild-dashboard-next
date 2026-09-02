import { ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import GearRankCalculator from "@/components/GearRankCalculator";

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-accent hover:underline"
    >
      {children}
      <ExternalLink size={12} />
    </a>
  );
}

export default async function ArcheAgePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">ArcheAge</h1>
        <p className="text-sm text-muted">Полезные инструменты и справочная информация по игре.</p>
      </div>

      <GearRankCalculator />

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Паки — калькулятор dllib.ru (Dead Legion)</h2>
        <p className="text-sm text-muted-2">
          Живой калькулятор паков именно под ваш сервер (версия 8.0): доход по каждому рецепту с учётом текущего
          % цен, где крафтить и куда везти на продажу — с реальными названиями локаций сервера. Плюс полная база
          предметов «Крафкулятор» (экипировка, петы и транспорт, ресурсы, расходка, усиление ГС, мебель) и отдельно
          ресурсы под паки по регионам.
        </p>
        <div className="flex flex-wrap gap-2">
          <SourceLink href="https://dllib.ru/">Паки — таблица цен</SourceLink>
          <SourceLink href="https://dllib.ru/">Ресурсы для паков</SourceLink>
          <SourceLink href="https://dllib.ru/">Крафкулятор — база предметов</SourceLink>
        </div>
        <p className="text-xs text-muted">
          Все три инструмента на одном сайте — переключаются кнопками сверху страницы («паки» / «крафкулятор»),
          цены пересчитываются на лету под выбранный процент, поэтому таблицу лучше открывать напрямую, а не
          копировать сюда — тут она мгновенно устареет.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Крафт торговых паков — общая механика</h2>
        <p className="text-sm text-muted-2">
          Справочно, по официальной англоязычной вики ArcheAge — названия локаций и детали там западные, могут не
          совпадать с вашим сервером один в один. Для реальных цифр используйте dllib.ru выше.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
          <li>
            Сначала нужен <span className="font-medium">торговый сертификат</span> (Merchant Certificate) — покупается
            у ремесленного торговца за серебро.
          </li>
          <li>
            <span className="font-medium">Специальные паки</span> (Specialty Packages) крафтятся на специальном
            верстаке (Specialty Workbench) — свой в каждой зоне, ищется на карте через фильтр
            Инфраструктура → Specialty Workbench.
          </li>
          <li>
            <span className="font-medium">Паки содружества</span> (Fellowship Packages) крафтятся на площади
            содружества (Fellowship Plaza).
          </li>
          <li>
            <span className="font-medium">Состаренные паки</span> (Aged Larders) требуют доступа к мастерской
            фермера (Farmer&apos;s Workshop).
          </li>
          <li>На один пак обычно уходит около 60 очков труда; расход снижается с ростом навыка Коммерции.</li>
          <li>
            Точные рецепты — какие именно ресурсы нужны под конкретный пак — смотрите в игровом фолио: Коммерция →
            Специальности Харанья/Нуа.
          </li>
        </ul>
        <p className="text-xs text-muted">
          Источники:{" "}
          <SourceLink href="https://archeage.fandom.com/wiki/Trade_Packages">
            ArcheAge Wiki — Trade Packages
          </SourceLink>
          ,{" "}
          <SourceLink href="https://www.tentonhammer.com/guides/archeage-trade-pack-guide">
            Ten Ton Hammer — Trade Pack Guide
          </SourceLink>
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Куда сдавать паки и брать ресурсы</h2>
        <p className="text-sm text-muted-2">
          Пак нужно довезти живым до торгового поста и сдать специальному скупщику (Specialty Buyer) — чем дальше
          довезли от места крафта, тем выше награда золотом/звёздами Гильды.
        </p>
        <p className="text-sm text-foreground">Основные торговые точки сбыта, восток и запад континента:</p>
        <p className="text-sm text-muted-2">
          Sollis Headlands, Mahadevi, Villanelle, Falcorth Plains, Arcus Iris, Ynystere — восток; Solzreed
          Peninsula, Gweonid Forest, Marianople, Two Crowns, Cinderstone Moor, Sanddeep — запад.
        </p>
        <p className="text-xs text-muted">
          Точные маршруты и актуальные цены зависят от текущей экономики сервера — свежие данные смотрите здесь:{" "}
          <SourceLink href="https://archeage.fandom.com/wiki/Trade_Routes">ArcheAge Wiki — Trade Routes</SourceLink>,{" "}
          <SourceLink href="https://www.ayinmaiden.com/archeage/tradesystem">AyinMaiden — Trade System</SourceLink>
        </p>
      </div>

      <p className="text-xs text-muted">
        Раздел можно дополнить — пришлите конкретные данные вашего сервера (скрины фолио, точные рецепты, цены), и
        я оформлю их отдельной таблицей вместо общих описаний выше.
      </p>
    </div>
  );
}
