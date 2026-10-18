def calculate_total(prices):
    total = 0
    for price in prices:
        if price > 0:
            total += price
    return total


print(calculate_total([120, 80, -10, 50]))
