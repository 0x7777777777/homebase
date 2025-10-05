const { expect } = require("chai");
const { ethers } = require("hardhat");

const parseUnits = (value) => ethers.utils.parseUnits(value, 18);

describe("MGRO", function () {
  let mgro;
  let management;
  let alice;
  const initialSupply = parseUnits("1000");

  beforeEach(async function () {
    [management, alice] = await ethers.getSigners();
    const MGRO = await ethers.getContractFactory("MGRO");
    mgro = await MGRO.connect(management).deploy(initialSupply);
    await mgro.deployed();
  });

  it("reverts when attempting to burn a third-party balance without approval", async function () {
    const burnAmount = parseUnits("10");
    await mgro.connect(management).transfer(alice.address, burnAmount);

    await expect(
      mgro.connect(management).burnTokens(alice.address, burnAmount)
    ).to.be.revertedWith("MGRO: insufficient allowance");
  });

  it("allows management to burn tokens after pulling them with allowance", async function () {
    const burnAmount = parseUnits("15");
    await mgro.connect(management).transfer(alice.address, burnAmount);
    await mgro.connect(alice).approve(management.address, burnAmount);

    await expect(mgro.connect(management).burnTokens(alice.address, burnAmount))
      .to.emit(mgro, "Transfer")
      .withArgs(management.address, ethers.constants.AddressZero, burnAmount);

    expect(await mgro.balanceOf(alice.address)).to.equal(ethers.constants.Zero);
    expect(await mgro.balanceOf(management.address)).to.equal(initialSupply.sub(burnAmount));
    expect(await mgro.totalSupply()).to.equal(initialSupply.sub(burnAmount));
  });

  it("lets management burn its own holdings directly", async function () {
    const burnAmount = parseUnits("20");

    await expect(mgro.connect(management).burnTokens(management.address, burnAmount))
      .to.emit(mgro, "Transfer")
      .withArgs(management.address, ethers.constants.AddressZero, burnAmount);

    expect(await mgro.balanceOf(management.address)).to.equal(initialSupply.sub(burnAmount));
    expect(await mgro.totalSupply()).to.equal(initialSupply.sub(burnAmount));
  });

  it("prevents non-management accounts from burning", async function () {
    const burnAmount = parseUnits("5");
    await expect(mgro.connect(alice).burnTokens(alice.address, burnAmount)).to.be.revertedWith(
      "MGRO: unauthorized"
    );
  });
});
