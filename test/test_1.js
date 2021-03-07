const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider || 'ws://localhost:8545');
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');
const truffleAssert = require('truffle-assertions');

const DraftLaws = artifacts.require("DraftLaws");
const THRESHOLD = 3;

describe("Testset for draftlaws voting contract", () => {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    let owner;
    let signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8,
    signer9, signer10;
    let notSigner1, notSigner2;

    let contractInstance;
    let signersArray;
    let snapshotId;

    before(async () => {
        [
            owner,
            signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8, signer9, signer10,
            notSigner1, notSigner2
        ] = await web3.eth.getAccounts();

        signersArray =  [signer1, signer2, signer3, signer4, signer5, signer6, signer7, signer8,
                         signer9, signer10];
        
        contractInstance = await DraftLaws.new([signer1, signer2, signer3, signer4, signer5, signer6,
             signer7, signer8, signer9, signer10], {from: owner});
    });

    describe("Creation tests", () => {
        beforeEach(async() => {
            // Create a snapshot
            const snapshot = await timeMachine.takeSnapshot();
            snapshotId = snapshot['result'];
          });
      
          afterEach(async() => await timeMachine.revertToSnapshot(snapshotId));

          it('Signer addresses in contract matches array in test', async () => {
            for (let i = 0; i < 10; i++) {
                expect( await contractInstance.signers(i)).to.equal(signersArray[i]);
            }
          });

          it('Addressed from array are signers', async () => {
            for (let i = 0; i < 10; i++) {
                expect (await contractInstance.isSigner(signersArray[i])).to.be.true;
            }
          });

          it('Should set correct amount of signers', async () => {
            await truffleAssert.fails(contractInstance.signers(10));
          });

          it('There are no draftlaws in newly created contract', async () => {
            expect((await contractInstance.draftlawsCount()).toNumber()).to.equal(0);
          });

          it('Should not create contract with wrong amount of signers', async () =>{
            await truffleAssert.reverts(
                DraftLaws.new([signer1, signer2, signer3, signer4, signer5], {from: owner}),
                "Wrong amount of signers"
            );
          });

          it('Should not init signer with zero address', async () => {
            await truffleAssert.reverts(
                DraftLaws.new([signer1, signer2, signer3, zeroAddress, signer5, signer6,
                    signer7, signer8, signer9, signer10], {from: owner}),
                    "Zero address"
                );
          });

          it('Addresses must not repeat', async () => {
            await truffleAssert.reverts(
                DraftLaws.new([signer1, signer2, signer3, signer4, signer5, signer6,
                    signer7, signer1, signer9, signer10], {from: owner}),
                    "Signer's address repeats"
            );
          }); 
    });

    describe('Replace signer function test', () => {
      beforeEach(async() => {
        // Create a snapshot
        const snapshot = await timeMachine.takeSnapshot();
        snapshotId = snapshot['result'];
      });
  
      afterEach(async() => await timeMachine.revertToSnapshot(snapshotId));

      it('Should replace previous signer with new one', async () => {
        await contractInstance.replaceSigner(signer1, notSigner1, {from: owner});
        expect((await contractInstance.signers(0)).toString()).to.equal(notSigner1);
        expect(await contractInstance.isSigner(notSigner1)).to.be.true;
        expect(await contractInstance.isSigner(signer1)).to.be.false;
      });

      it('Only owner can call', async () => {
        await truffleAssert.reverts(
          contractInstance.replaceSigner(signer1, notSigner1, {from: signer5}),
          "Ownable: caller is not the owner"
        );
      });

      it('Previous address is not a signer', async () => {
        await truffleAssert.reverts(
          contractInstance.replaceSigner(notSigner1, notSigner2, {from: owner}),
          "Not a signer"
        );
      });

      it('New address is already a signer', async () => {
        await truffleAssert.reverts(
          contractInstance.replaceSigner(signer1, signer2, {from: owner}),
          "Already a signer"
        );
      });
    });

    describe("Draftlaw voting process test", () => {
      beforeEach(async() => {
        // Create a snapshot
        const snapshot = await timeMachine.takeSnapshot();
        snapshotId = snapshot['result'];
      });
  
      afterEach(async() => await timeMachine.revertToSnapshot(snapshotId));

      it('Register and confirm new draftlaw', async () => {
        expect((await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1})).toNumber())
            .to.equal(0);

        expect((await contractInstance.draftlawsCount()).toNumber()).to.equal(1);
        expect(await contractInstance.confirmations(0, signer1)).to.be.true;

        const dl = await contractInstance.draftLaws(0);
        expect(dl[0]).to.equal("Draftlaw");
        expect(dl[1].toString()).to.equal(signer1);
        expect(dl[2].toNumber()).to.equal(7777);
        expect(dl[5]).to.be.false;
      });

      it('Only signer can register a draftlaw', async () => {
        await truffleAssert.reverts(
          contractInstance.registerDraftLaw("Draftlaw", 7777, {from: owner}),
          "Not a signer"
        );
      });

      it('Should confirm a draftlaw', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.confirmDraftLaw(0, {from: signer2});
        expect(await contractInstance.confirmations(0, signer2)).to.be.true;
      });

      it('Only signer can confirm', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await truffleAssert.reverts(
          contractInstance.confirmDraftLaw(0, {from: owner}),
          "Not a signer"
        );
      });

      it('Try to confirm a non-existing draftlaw', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await truffleAssert.reverts(
          contractInstance.confirmDraftLaw(1, {from: signer2}),
          "DraftLaw with such id doesn't exist"
        );
      });

      it('Should not let confirm draftlaw after its expiration', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await timeMachine.advanceTime(15*86400);
        await truffleAssert.reverts(
          contractInstance.confirmDraftLaw(0, {from: signer2}),
          "draftlaw expired"
        );
      });

      it('Cant confirm draftlaw two times in a row', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.confirmDraftLaw(0, {from: signer2});
        await truffleAssert.reverts(
          contractInstance.confirmDraftLaw(0, {from: signer2}),
          "Already confirmed"
        );
      });

      it('Signer can revoke draftlaw only after confirm', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await truffleAssert.reverts(
          contractInstance.revokeDraftLaw(0, {from: signer2}),
          "Not yet confirmed"
        );
      });

      it('Revoking a vote', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.revokeDraftLaw(0, {from: signer1});
        expect(await contractInstance.confirmations(0, signer1)).to.be.false;
      });

      it('Only owner can call approve function', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await timeMachine.advanceTime(15*86400);
        await truffleAssert.reverts(
          contractInstance.approveDraftLaw(0, {from: signer1}),
          "Ownable: caller is not the owner"
        );
        expect((await contractInstance.approveDraftLaw(0, {from: owner})).toNumber()).to.equal(1);
      });

      it('Cant call approve if draftlaw is already approved', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.confirmDraftLaw(0, {from: signer2});
        await contractInstance.confirmDraftLaw(0, {from: signer3});
        await timeMachine.advanceTime(15*86400);
        await contractInstance.approveDraftLaw(0, {from: owner});
        await truffleAssert.reverts(
          contractInstance.approveDraftLaw(0, {from: owner}),
          "Already approved"
        );
      });

      it('Approve only after draftlaw expiration', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await timeMachine.advanceTime(7*86400);
        await truffleAssert.reverts(
          contractInstance.approveDraftLaw(0, {from: owner}),
          "Voting still in progress"
        );
      });

      it('Reject draftlaw', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await timeMachine.advanceTime(15*86400);
        await contractInstance.approveDraftLaw(0, {from: owner});
        const dl = await contractInstance.draftLaws(0);
        expect(dl[5]).to.be.false;
      });

      it('Approve draftlaw', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.confirmDraftLaw(0, {from: signer2});
        await contractInstance.confirmDraftLaw(0, {from: signer3});
        await timeMachine.advanceTime(15*86400);
        await contractInstance.approveDraftLaw(0, {from: owner});
        const dl = await contractInstance.draftLaws(0);
        expect(dl[5]).to.be.true;
      });

      it('Check confirmation status during voting(still not enough votes)', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.confirmDraftLaw(0, {from: signer2});
        expect(await contractInstance.isConfirmed(0)).to.be.false;
      });

      it('Check confirmation status during voting(enough votes)', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.confirmDraftLaw(0, {from: signer2});
        await contractInstance.confirmDraftLaw(0, {from: signer3});
        expect(await contractInstance.isConfirmed(0)).to.be.true;
      });

      it('Check confirmation status after voting(draftlaw was approved)', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.confirmDraftLaw(0, {from: signer2});
        await contractInstance.confirmDraftLaw(0, {from: signer3});
        await timeMachine.advanceTime(15*86400);
        await contractInstance.approveDraftLaw(0, {from: owner});
        expect(await contractInstance.isConfirmed(0)).to.be.true;
      });

      it('Check confirmation status after voting(draftlaw was rejected)', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await timeMachine.advanceTime(15*86400);
        await contractInstance.approveDraftLaw(0, {from: owner});
        expect(await contractInstance.isConfirmed(0)).to.be.false;
      });

      it('Should return confirmations count', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.confirmDraftLaw(0, {from: signer2});
        expect((await contractInstance.getConfirmationCount(0)).toNumber()).to.equal(2);
      });

      it('Should return THRESHOLD', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.confirmDraftLaw(0, {from: signer2});
        await contractInstance.confirmDraftLaw(0, {from: signer3});
        await timeMachine.advanceTime(15*86400);
        await contractInstance.approveDraftLaw(0, {from: owner});
        expect((await contractInstance.getConfirmationCount(0)).toNumber()).to.equal(THRESHOLD);
      });

      it('Get amount of current draftlaws', async () => {
        await contractInstance.registerDraftLaw("Draftlaw", 7777, {from: signer1});
        await contractInstance.registerDraftLaw("Draftlaw", 2222, {from: signer2});
        await contractInstance.confirmDraftLaw(0, {from: signer2});
        await contractInstance.confirmDraftLaw(0, {from: signer3});
        await timeMachine.advanceTime(15*86400);
        await contractInstance.approveDraftLaw(0, {from: owner});

        await contractInstance.registerDraftLaw("Draftlaw", 1234, {from: signer1});
        await contractInstance.registerDraftLaw("Draftlaw", 5678, {from: signer2});

        expect((await contractInstance.getCurrentDraftlawsCount()).toNumber()).to.equal(2);
      });
    });
});