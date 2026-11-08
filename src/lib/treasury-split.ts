/** Gross category receipts, before 70/30 salary allocation. Used by balances and charts. */
export function splitTreasuryReceipt(
  amount: number,
  category: string | null,
  sold: { category: string | null; value: number; quantity: number }[],
) {
  if (!sold.length)
    return {
      prime: category === "Прайм" ? amount : 0,
      miniRb: category === "Мини-РБ" ? amount : 0,
    };
  const nominal = sold.reduce(
    (sum, item) => sum + item.value * item.quantity,
    0,
  );
  if (nominal <= 0) return { prime: amount, miniRb: 0 };
  const primeNominal = sold
    .filter((item) => item.category !== "Мини-РБ")
    .reduce((sum, item) => sum + item.value * item.quantity, 0);
  const prime = (amount * primeNominal) / nominal;
  return { prime, miniRb: amount - prime };
}
