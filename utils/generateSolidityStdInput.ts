import fs from 'fs';
import path from 'path';

import hre from 'hardhat';

const generateSolidityStdInputForContract = async (contractName: string) => {
  const contractArtifact = await hre.artifacts.readArtifact(contractName);
  const buildInfo = await hre.artifacts.getBuildInfo(
    `${contractArtifact.sourceName}:${contractArtifact.contractName}`
  );

  const foldername = path.join(__dirname, '..', 'stdins');
  await fs.promises.mkdir(foldername, { recursive: true });

  const filename = path.join(foldername, `${contractName}.stdin.json`);

  await fs.promises.writeFile(
    filename,
    JSON.stringify(buildInfo?.input, null, 4)
  );

  console.log(`Generated Solidity Std Input in file ${filename}`);
};

export { generateSolidityStdInputForContract };
