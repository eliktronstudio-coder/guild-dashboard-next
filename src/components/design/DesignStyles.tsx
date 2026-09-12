/** Тег со скомпилированными стилями. Пустой конфиг не печатает ничего. */
export default function DesignStyles({ css }: { css: string }) {
  if (!css) return null;
  // Содержимое собрано компилятором из проверенных значений (см. compile.ts):
  // произвольная строка сюда попасть не может.
  return <style id="xd-design" dangerouslySetInnerHTML={{ __html: css }} />;
}
