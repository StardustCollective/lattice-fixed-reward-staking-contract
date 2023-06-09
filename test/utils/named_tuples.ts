type TuplePair<K extends string, V> = [K, V];

const createNamedTuple = <Pair extends TuplePair<string, any>>(
  ...properties: Pair[]
) => {
  const tupple: any[] = [];

  for (const [key, value] of properties) {
    tupple.push(value);
    Object.defineProperty(tupple, key, { value, enumerable: true });
  }

  return tupple;
};

export { createNamedTuple };
