import { ContractTransaction } from 'ethers';

const waitForTransaction = async (
  trx: Promise<ContractTransaction> | ContractTransaction
) => {
  const _trx = await trx;
  const receipt = await _trx.wait();
  return receipt;
};

export { waitForTransaction };
