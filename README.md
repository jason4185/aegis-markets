# Aegis Markets

A GenLayer-native protection protocol for currencies and metals, combining fixed payout terms, independent market-data verification, permissionless settlement, and transparent onchain claims.

## Overview

Aegis Markets provides fixed-payout protection against defined adverse movements in selected currency and precious-metal markets. Users choose a supported market, coverage duration, and movement threshold. The intelligent contract establishes the premium, payout, reference price, trigger, and settlement window at purchase.

## Supported Markets

- GBP/USD
- USD/JPY
- USD/TRY
- XAU/USD
- XAG/USD

Each market has a contract-defined adverse direction. Users do not choose or override that direction.

## How It Works

1. A user chooses a market, duration, and movement threshold.
2. The contract establishes the fixed premium and payout and locks the purchase reference price.
3. GenLayer validators independently fetch and confirm the configured FXRatesAPI purchase reference.
4. Permissionless daily settlement compares dated FXRatesAPI Historical and Fawaz values against the stored trigger.
5. Callers cannot provide prices, select outcomes, or redirect payouts.
6. If protection becomes claimable, only its owner can claim the fixed payout.

## Repository Structure

```text
aegis-markets/
├── contract/   # GenLayer intelligent contract
├── frontend/   # TypeScript frontend originating from the Lovable prototype
├── docs/       # Architecture, economics, settlement, and security notes
├── tests/      # Contract-focused tests
├── README.md
└── .gitignore
```

## Intelligent Contract

The production contract is [`contract/AegisProtection.py`](contract/AegisProtection.py). It defines the five markets, fixed economics, shared liquidity pool, live purchase-reference consensus, dated two-source settlement, protection lifecycle, claims, and administrative purchase pause.

Settlement triggering is permissionless, but the market, sources, reference price, trigger, direction, and outcome are contract-controlled. Pausing affects new purchases only; settlement and owner claims remain available.

## Frontend

The frontend in [`frontend/`](frontend/) originated from the Lovable prototype and is now maintained in this repository. It includes mocked data and a contract-service abstraction. It must not be assumed to be connected to a deployed contract until a deployment address and live GenLayer integration are explicitly configured and verified.

## Local Development

The frontend uses Bun, matching its committed lockfile:

```sh
cd frontend
bun install
bun run dev
```

For contract tests and validation tooling:

```sh
python3 -m pip install -r requirements.txt
python3 -m pytest -q
genvm-lint check contract/AegisProtection.py
```

## Deployment Status

This repository setup does not deploy the contract or frontend. The frontend may still use mock data or placeholder services, and no live contract integration is claimed here.

## Security Model

- Purchase terms, market directions, premiums, payouts, and triggers are defined by the contract.
- GenLayer validators independently confirm the configured purchase source response.
- Daily settlement uses normalized FXRatesAPI Historical and Fawaz evidence for the requested date.
- A settlement caller cannot supply prices or choose the result.
- Protection claims are restricted to the protection owner.
- Reserved pool liability cannot be withdrawn as unreserved liquidity.
- The administrative pause blocks new purchases only, not settlement or claims.

