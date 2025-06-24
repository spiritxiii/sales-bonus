/**
 * Функция для расчета прибыли
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount, sale_price, quantity } = purchase;

  // остаток суммы без скидки
  const withoutDiscount = 1 - discount / 100;

  return sale_price * quantity * withoutDiscount;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  let bonusPercent;

  switch (index) {
    case 0:
      bonusPercent = 0.15;
      break;
    case 1:
    case 2:
      bonusPercent = 0.1;
      break;
    case total - 1:
      bonusPercent = 0;
      break;
    default:
      bonusPercent = 0.05;
  }

  return bonusPercent * seller.profit;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.purchase_records) ||
    !Array.isArray(data.products) ||
    data.sellers.length === 0 ||
    data.purchase_records.length === 0 ||
    data.products.length === 0
  ) {
    throw new Error('Некорректные входные данные');
  }

  if (typeof options !== 'object' || options.length < 2) {
    throw new Error('Отсутствует список функций для обработки данных');
  }

  const { calculateRevenue, calculateBonus } = options; // Сюда передадим функции для расчётов

  if (
    !calculateRevenue ||
    !calculateBonus ||
    typeof calculateRevenue !== 'function' ||
    typeof calculateBonus !== 'function'
  ) {
    throw new Error('В списке переданных функций их меньше, чем требуется');
  }

  // Подготовка промежуточных данных для сбора статистики
  const sellerStats = data.sellers.map((seller) => seller);
  const productStats = data.products.map((product) => product);

  // Индексация продавцов и товаров для быстрого доступа
  // Ключом будет id, значением — запись из sellerStats
  const sellerIndex = Object.fromEntries(
    sellerStats.map((item) => [item.id, item])
  );
  // Ключом будет sku, значением — запись из data.products
  const productIndex = Object.fromEntries(
    productStats.map((item) => [item.sku, item])
  );

  // Расчет выручки и прибыли для каждого продавца
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    seller.products_sold = seller.products_sold || {};

    // Увеличим количество продаж
    seller.sales_count = (seller.sales_count ?? 0) + 1;

    // Увеличим общую сумму всех продаж
    seller.revenue = (seller.revenue ?? 0) + record.total_amount;

    // Расчёт прибыли для каждого товара
    record.items.forEach((item) => {
      const product = productIndex[item.sku]; // Товар
      const cost = product.purchase_price * item.quantity; // Себестоимость товаров
      const revenue = calculateSimpleRevenue(item); // Выручку с учётом скидки
      const profit = revenue - cost; // Прибыль: выручка минус себестоимость

      // Увеличить общую накопленную прибыль (profit) у продавца
      seller.profit = (seller.profit ?? 0) + profit;

      // Учёт количества проданных товаров
      seller.products_sold[item.sku] =
        (seller.products_sold?.[item.sku] ?? 0) + item.quantity;
    });
  });

  // Сортировка продавцов по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Назначение премий на основе ранжирования
  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonusByProfit(index, sellerStats.length, seller); // Считаем бонус

    // Формируем топ-10 товаров
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });

  // Подготовка итоговой коллекции с нужными полями
  return sellerStats.map((seller) => ({
    seller_id: seller.id, // Строка, идентификатор продавца
    name: `${seller.first_name} ${seller.last_name}`, // Строка, имя продавца
    revenue: +seller.revenue.toFixed(2), // Число с двумя знаками после точки, выручка продавца
    profit: +seller.profit.toFixed(2), // Число с двумя знаками после точки, прибыль продавца
    sales_count: seller.sales_count, // Целое число, количество продаж продавца
    top_products: seller.top_products, // Целое число, топ-10 товаров продавца
    bonus: +seller.bonus.toFixed(2), // Число с двумя знаками после точки, бонус продавца
  }));
}
