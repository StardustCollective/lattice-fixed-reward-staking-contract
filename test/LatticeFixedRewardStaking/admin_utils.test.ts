describe('LatticeFixedRewardsStaking :: Admin Utils', () => {
  describe('Recover ERC20', () => {
    it('Can recover lost ERC20 funds');

    it('Emits correct event on lost ERC20 funds recovered');

    describe('Reverts', () => {
      it('On bad token (staking token)');

      it('On bad token (reward token)');

      it('On not enough tokens to recover');
    });
  });

  describe('Pause/Unpause', () => {
    it('Can pause the contract');

    it('Can unpause the contract');
  });
});
