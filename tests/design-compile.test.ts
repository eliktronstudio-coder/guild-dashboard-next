import test from "node:test";
import assert from "node:assert/strict";

import { compileConfig, normalizeConfig } from "../src/lib/design/compile";
import { SHARED_KEY } from "../src/lib/design/registry";
import { emptyConfig } from "../src/lib/design/types";

function cfg(elements: Record<string, unknown>, tokens?: Record<string, string>) {
  return { ...emptyConfig(), elements, tokens } as never;
}

test("правило страницы ограничено этой страницей", () => {
  const css = compileConfig(
    normalizeConfig(cfg({ "home.myChart": { color: { base: { normal: "#ff0000" } } } }), "home"),
    "home"
  );
  assert.match(css, /\[data-design-page="home"\] \[data-design-el="home\.myChart"\]/);
  // Нет правила без ограничения страницей — иначе стиль утёк бы на другие страницы.
  assert.doesNotMatch(css, /(^|})\[data-design-el=/);
});

test("общие правила компилируются без ограничения страницей", () => {
  const css = compileConfig(
    normalizeConfig(cfg({ "shared.sidebar": { backgroundColor: { base: { normal: "#101010" } } } }), SHARED_KEY),
    SHARED_KEY
  );
  assert.match(css, /\[data-design-el="shared\.sidebar"\]\{background-color: #101010\}/);
  assert.doesNotMatch(css, /data-design-page/);
});

test("общий элемент, изменённый на странице, получает область страницы", () => {
  const css = compileConfig(
    normalizeConfig(cfg({ "shared.panel": { borderRadius: { base: { normal: "20px" } } } }), "players"),
    "players"
  );
  assert.match(css, /\[data-design-page="players"\] \[data-design-el="shared\.panel"\]/);
});

test("элемент не из реестра страницы отбрасывается", () => {
  // home.myChart принадлежит «Главной»; в конфиге «Состава» его быть не должно.
  const config = normalizeConfig(cfg({ "home.myChart": { color: { base: { normal: "#fff" } } } }), "players");
  assert.deepEqual(config.elements, {});
});

test("выдуманный идентификатор отбрасывается", () => {
  const config = normalizeConfig(cfg({ "evil.injected": { color: { base: { normal: "#fff" } } } }), "home");
  assert.deepEqual(config.elements, {});
});

test("попытки инъекции в значение не проходят валидацию", () => {
  const attempts = [
    "red;} body{display:none",
    "url(javascript:alert(1))",
    "expression(alert(1))",
    "#fff}@import 'x'",
    "</style><script>alert(1)</script>",
  ];
  for (const value of attempts) {
    const config = normalizeConfig(cfg({ "home.myChart": { color: { base: { normal: value } } } }), "home");
    assert.deepEqual(config.elements, {}, `пропущено значение: ${value}`);
  }
});

test("валидные значения сохраняются, включая токены темы", () => {
  const config = normalizeConfig(
    cfg({ "home.myChart": { color: { base: { normal: "var(--accent)" } }, padding: { mobile: { normal: "8px" } } } }),
    "home"
  );
  assert.equal(config.elements["home.myChart"].color?.base?.normal, "var(--accent)");
  assert.equal(config.elements["home.myChart"].padding?.mobile?.normal, "8px");
});

test("мобильные значения попадают в медиазапрос, а не в базовое правило", () => {
  const css = compileConfig(
    normalizeConfig(cfg({ "home.myChart": { padding: { mobile: { normal: "8px" } } } }), "home"),
    "home"
  );
  assert.match(css, /@media \(max-width: 767px\)\{/);
  // Базовое правило не должно появиться: значение задано только для телефона.
  const beforeMedia = css.slice(0, css.indexOf("@media"));
  assert.doesNotMatch(beforeMedia, /padding/);
});

test("состояние наведения игнорируется у свойств, где оно не поддержано", () => {
  // padding не помечен stateful — значение для hover должно отбрасываться.
  const config = normalizeConfig(cfg({ "home.myChart": { padding: { base: { hover: "20px" } } } }), "home");
  assert.deepEqual(config.elements, {});

  // color помечен stateful — значение сохраняется и даёт правило :hover.
  const css = compileConfig(
    normalizeConfig(cfg({ "home.myChart": { color: { base: { hover: "#fff" } } } }), "home"),
    "home"
  );
  assert.match(css, /\[data-design-el="home\.myChart"\]:hover\{color: #fff\}/);
});

test("токены темы пишутся только в общем конфиге", () => {
  const shared = normalizeConfig(cfg({}, { accent: "#123456" }), SHARED_KEY);
  assert.equal(shared.tokens?.accent, "#123456");
  assert.match(compileConfig(shared, SHARED_KEY), /:root\{--accent: #123456\}/);

  const pageLevel = normalizeConfig(cfg({}, { accent: "#123456" }), "home");
  assert.deepEqual(pageLevel.tokens, {});
  assert.doesNotMatch(compileConfig(pageLevel, "home"), /:root/);
});

test("неизвестный токен темы отбрасывается", () => {
  const shared = normalizeConfig(cfg({}, { "evil-token": "#000" }), SHARED_KEY);
  assert.deepEqual(shared.tokens, {});
});

test("пустой конфиг не печатает CSS", () => {
  assert.equal(compileConfig(emptyConfig(), "home"), "");
});
