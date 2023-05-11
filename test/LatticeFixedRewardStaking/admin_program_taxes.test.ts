describe('LatticeFixedRewardsStaking :: Admin Program Taxes', () => {
  describe('Withdraw Program Taxes', () => {
    it('Can withdraw program taxes');

    describe('Reverts', () => {
      it('On bad amount specified');

      it('On not enough program taxes');
    });
  });

  describe('Update Program Tax', () => {
    it('Can update program tax');

    it('Emits correct event on program tax update');

    describe('Reverts', () => {
      it('On bad tax ratio specified');
    });
  });
});
