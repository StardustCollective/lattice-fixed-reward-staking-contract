import Decimal from 'decimal.js';

const showUintMaximums = () => {
  Decimal.set({ precision: 100 });
  for (let exp = 8; exp <= 256; exp += 8) {
    console.log(`Uint${exp} => Max(${Decimal.pow(2, exp).minus(1).toFixed()})`);
  }
};

showUintMaximums();
