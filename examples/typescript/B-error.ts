interface Item {
    name: string;
    price: ;
}

function calculateTotal(items: Item[]): number {
    return items.reduce((total, item) => total + item.price, 0);
}

const items: Item[] = [{ name: "Notebook", price: 12 }];
console.log(calculateTotal(items));
