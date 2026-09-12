import test from "node:test";
import assert from "node:assert/strict";

import { compileConfig, isSafeHref, normalizeConfig } from "../src/lib/design/compile";
import { SHARED_KEY } from "../src/lib/design/registry";
import { emptyConfig, type PageConfig } from "../src/lib/design/types";

function cfg(patch: Partial<PageConfig>): PageConfig {
  return { ...emptyConfig(), ...patch } as PageConfig;
}

test("правило страницы ограничено этой страницей", () => {
  const css = compileConfig(
    normalizeConfig(cfg({ elements: { "home.myChart": { color: { base: { normal: "#ff0000" } } } } }), "home"),
    "home"
  );
  assert.match(css, /\[data-design-page="home"\] \[data-design-el="home\.myChart"\]/);
  assert.doesNotMatch(css, /(^|})\[data-design-el=/);
});

test("общие правила компилируются без ограничения страницей", () => {
  const css = compileConfig(
    normalizeConfig(cfg({ elements: { "shared.sidebar": { backgroundColor: { base: { normal: "#101010" } } } } }), SHARED_KEY),
    SHARED_KEY
  );
  assert.match(css, /\[data-design-el="shared\.sidebar"\]\{background-color: #101010\}/);
  assert.doesNotMatch(css, /data-design-page/);
});

test("общий элемент, изменённый на странице, получает область страницы", () => {
  const css = compileConfig(
    normalizeConfig(cfg({ elements: { "shared.panel": { borderRadius: { base: { normal: "20px" } } } } }), "players"),
    "players"
  );
  assert.match(css, /\[data-design-page="players"\] \[data-design-el="shared\.panel"\]/);
});

test("элемент не из реестра страницы отбрасывается", () => {
  const config = normalizeConfig(cfg({ elements: { "home.myChart": { color: { base: { normal: "#fff" } } } } }), "players");
  assert.deepEqual(config.elements, {});
});

test("выдуманный идентификатор отбрасывается", () => {
  const config = normalizeConfig(cfg({ elements: { "evil.injected": { color: { base: { normal: "#fff" } } } } }), "home");
  assert.deepEqual(config.elements, {});
});

test("попытки инъекции в значение не проходят валидацию", () => {
  const attempts = [
    "red;} body{display:none",
    "url(javascript:alert(1))",
    "expression(alert(1))",
    "#fff}@import 'x'",
    "</style><script>alert(1)</script>",
    "url(https://evil.example/x.png)",
  ];
  for (const value of attempts) {
    const config = normalizeConfig(cfg({ elements: { "home.myChart": { color: { base: { normal: value } } } } }), "home");
    assert.deepEqual(config.elements, {}, `пропущено значение: ${value}`);
  }
});

test("мобильные значения попадают в медиазапрос, а не в базовое правило", () => {
  const css = compileConfig(
    normalizeConfig(cfg({ elements: { "home.myChart": { padding: { mobile: { normal: "8px" } } } } }), "home"),
    "home"
  );
  assert.match(css, /@media \(max-width: 767px\)\{/);
  const beforeMedia = css.slice(0, css.indexOf("@media"));
  assert.doesNotMatch(beforeMedia, /padding/);
});

test("состояния применяются только к поддерживающим их свойствам", () => {
  const dropped = normalizeConfig(cfg({ elements: { "home.myChart": { padding: { base: { hover: "20px" } } } } }), "home");
  assert.deepEqual(dropped.elements, {});

  const css = compileConfig(
    normalizeConfig(
      cfg({ elements: { "home.myChart": { color: { base: { hover: "#fff", focus: "#eee", disabled: "#ccc" } } } } }),
      "home"
    ),
    "home"
  );
  assert.match(css, /\[data-design-el="home\.myChart"\]:hover\{color: #fff\}/);
  assert.match(css, /:focus-visible\{color: #eee\}/);
  assert.match(css, /:disabled\{color: #ccc\}/);
});

test("токены темы пишутся по темам и только в общем конфиге", () => {
  const shared = normalizeConfig(cfg({ tokens: { dark: { accent: "#123456" }, light: { accent: "#abcdef" } } }), SHARED_KEY);
  assert.equal(shared.tokens?.dark?.accent, "#123456");
  assert.equal(shared.tokens?.light?.accent, "#abcdef");

  const css = compileConfig(shared, SHARED_KEY);
  assert.match(css, /:root\{--accent: #123456\}/);
  assert.match(css, /:root\[data-theme="light"\]\{--accent: #abcdef\}/);

  const pageLevel = normalizeConfig(cfg({ tokens: { dark: { accent: "#123456" } } }), "home");
  assert.deepEqual(pageLevel.tokens, { dark: {}, light: {} });
  assert.doesNotMatch(compileConfig(pageLevel, "home"), /:root/);
});

test("неизвестный токен темы отбрасывается", () => {
  const shared = normalizeConfig(cfg({ tokens: { dark: { "evil-token": "#000" } } }), SHARED_KEY);
  assert.deepEqual(shared.tokens?.dark, {});
});

test("фоновое изображение подставляется как адрес из id, а не как произвольный url", () => {
  const id = "abcdefghijklmnopqrst";
  const css = compileConfig(
    normalizeConfig(cfg({ elements: { "home.myChart": { backgroundMedia: { base: { normal: id } } } } }), "home"),
    "home"
  );
  assert.match(css, new RegExp(`background-image: url\\(/api/design/media/${id}/file\\)`));

  // Чужой url в это поле не проходит валидацию.
  const bad = normalizeConfig(
    cfg({ elements: { "home.myChart": { backgroundMedia: { base: { normal: "https://evil.example/x.png" } } } } }),
    "home"
  );
  assert.deepEqual(bad.elements, {});
});

test("анимация появления уходит под prefers-reduced-motion", () => {
  const css = compileConfig(
    normalizeConfig(
      cfg({
        elements: {
          "home.myChart": {
            appearAnimation: { base: { normal: "xd-fade-in" } },
            appearDuration: { base: { normal: "400ms" } },
          },
        },
      }),
      "home"
    ),
    "home"
  );
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)\{/);
  assert.match(css, /animation-name: xd-fade-in/);
  // Вне блока с prefers-reduced-motion анимации быть не должно.
  assert.doesNotMatch(css.slice(0, css.indexOf("@media (prefers-reduced-motion")), /animation-name/);
});

test("селекторы из реестра работают для кнопок и ячеек таблиц", () => {
  const css = compileConfig(
    normalizeConfig(
      cfg({
        elements: {
          "shared.button": { borderRadius: { base: { normal: "999px" } } },
          "shared.tableHeadCell": { color: { base: { normal: "var(--accent)" } } },
        },
      }),
      "treasury"
    ),
    "treasury"
  );
  assert.match(css, /\[data-design-page="treasury"\] main button:not\(\[data-design-el\]\)/);
  assert.match(css, /\[data-design-el="shared\.table"\] thead th/);
});

test("блоки нормализуются, чужие типы и дубли id отбрасываются", () => {
  const config = normalizeConfig(
    cfg({
      blocks: {
        top: [
          { id: "b1", type: "heading", text: "Привет" },
          { id: "b1", type: "text", text: "дубль id" },
          { id: "b2", type: "evil" as never, text: "чужой тип" },
          { id: "плохой id!", type: "text", text: "невалидный id" },
        ],
      },
    }),
    "home"
  );
  assert.equal(config.blocks?.top?.length, 1);
  assert.equal(config.blocks?.top?.[0].id, "b1");
  assert.equal(config.blocks?.top?.[0].text, "Привет");
});

test("разметка в тексте блока обезвреживается", () => {
  const config = normalizeConfig(
    cfg({ blocks: { top: [{ id: "b1", type: "text", text: "<script>alert(1)</script>" }] } }),
    "home"
  );
  assert.equal(config.blocks?.top?.[0].text, "scriptalert(1)/script");
});

test("ссылка кнопки принимает только маршруты и https", () => {
  assert.equal(isSafeHref("/dashboard"), true);
  assert.equal(isSafeHref("https://example.com/x"), true);
  assert.equal(isSafeHref("javascript:alert(1)"), false);
  assert.equal(isSafeHref("//evil.example"), false);
  assert.equal(isSafeHref("http://insecure.example"), false);

  const config = normalizeConfig(
    cfg({ blocks: { top: [{ id: "b1", type: "button", text: "Кнопка", href: "javascript:alert(1)" }] } }),
    "home"
  );
  assert.equal(config.blocks?.top?.[0].href, undefined, "опасная ссылка не должна сохраняться");
});

test("блок получает свой идентификатор элемента и может быть оформлен", () => {
  const config = normalizeConfig(
    cfg({
      blocks: { top: [{ id: "b1", type: "section" }] },
      elements: { "block.b1": { padding: { base: { normal: "24px" } } } },
    }),
    "home"
  );
  assert.ok(config.elements["block.b1"], "настройки блока должны сохраниться");
  const css = compileConfig(config, "home");
  assert.match(css, /\[data-design-page="home"\] \[data-design-el="block\.b1"\]\{padding: 24px\}/);
});

test("вложенность блоков ограничена", () => {
  // Пять уровней: пятый должен отсечься (MAX_BLOCK_DEPTH = 4).
  const deep = {
    id: "l0",
    type: "container" as const,
    children: [
      {
        id: "l1",
        type: "container" as const,
        children: [
          {
            id: "l2",
            type: "container" as const,
            children: [
              {
                id: "l3",
                type: "container" as const,
                children: [{ id: "l4", type: "container" as const, children: [{ id: "l5", type: "text" as const }] }],
              },
            ],
          },
        ],
      },
    ],
  };
  const config = normalizeConfig(cfg({ blocks: { top: [deep] } }), "home");
  let depth = 0;
  let node = config.blocks?.top?.[0];
  while (node?.children?.length) {
    depth++;
    node = node.children[0];
  }
  assert.ok(depth <= 4, `слишком глубокая вложенность: ${depth}`);
});

test("подписи принимаются только из реестра страницы", () => {
  const ok = normalizeConfig(cfg({ texts: { "home.titleSchedule": "Ближайшее" } }), "home");
  assert.equal(ok.texts?.["home.titleSchedule"], "Ближайшее");

  const foreign = normalizeConfig(cfg({ texts: { "home.titleSchedule": "Ближайшее" } }), "players");
  assert.deepEqual(foreign.texts, {});

  const unknown = normalizeConfig(cfg({ texts: { "evil.text": "x" } }), "home");
  assert.deepEqual(unknown.texts, {});
});

test("блокировки сохраняются только для известных элементов", () => {
  const config = normalizeConfig(cfg({ locks: ["home.myChart", "evil.el"] }), "home");
  assert.deepEqual(config.locks, ["home.myChart"]);
});

test("пустой конфиг не печатает CSS", () => {
  assert.equal(compileConfig(emptyConfig(), "home"), "");
});
