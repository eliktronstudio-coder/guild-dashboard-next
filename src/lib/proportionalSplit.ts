/**
 * Пропорциональное деление целой суммы методом наибольшего остатка.
 *
 * Обычное округление каждой доли по отдельности даёт сумму, не совпадающую
 * с исходной: на большом составе расхождение — десятки единиц. Здесь всем
 * сначала достаётся целая часть доли, а остаток раздаётся тем, у кого
 * дробный хвост больше, поэтому сумма долей всегда равна total.
 */
export function splitProportionally<T>(
  items: { item: T; weight: number }[],
  total: number
): { item: T; weight: number; sharePct: number; amount: number }[] {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);

  if (totalWeight <= 0 || total <= 0) {
    return items.map((i) => ({ item: i.item, weight: i.weight, sharePct: 0, amount: 0 }));
  }

  const exact = items.map((i) => {
    const value = (i.weight / totalWeight) * total;
    const floor = Math.floor(value);
    return {
      item: i.item,
      weight: i.weight,
      sharePct: (i.weight / totalWeight) * 100,
      floor,
      frac: value - floor,
    };
  });

  let rest = total - exact.reduce((sum, e) => sum + e.floor, 0);
  // Индексы по убыванию дробной части: именно им достаются оставшиеся единицы.
  const order = exact
    .map((e, index) => ({ index, frac: e.frac }))
    .sort((a, b) => b.frac - a.frac);

  const bonus = new Set<number>();
  for (let i = 0; i < order.length && rest > 0; i++, rest--) bonus.add(order[i].index);

  return exact.map((e, index) => ({
    item: e.item,
    weight: e.weight,
    sharePct: e.sharePct,
    amount: e.floor + (bonus.has(index) ? 1 : 0),
  }));
}
