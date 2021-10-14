<img src="https://cdn.edge.network/assets/img/edge-logo-green.svg" width="200">

# CLI

Command line interface for the Edge network

## Development

The simplest way to test this application on your development machine is to execute `npm run dev -- [your input]` which uses [ts-node](https://www.npmjs.com/package/ts-node) to automatically transpile code without writing output.

If you want to build and run source, for example if there is a problem with ts-node or you just want to compare results, you can execute `npm run build:src && npm run dev:from-src`

## Build

We use [pkg](https://www.npmjs.com/package/pkg) to build distributable binaries.

The recommended approach to build a CLI binary is using the Docker workflow. Start Docker, then execute `npm run build` and wait. When the process has completed, you should see a `bin/edge` file that you can execute directly on your host.

If you are unable to use the Docker build workflow, you can try building on host. You will need to install the `optionalDependencies` from package.json. Then, execute `npm run build:src && npm run build:executable` and wait; you should soon see a `bin/edge` file created that you can execute directly.

<!--
### CI Build

This section is TODO
-->

## License

Edge is the infrastructure of Web3. A peer-to-peer network and blockchain providing high performance decentralised web services, powered by the spare capacity all around us.

Copyright notice
(C) 2021 Edge Network Technologies Limited <support@edge.network><br />
All rights reserved

This product is part of Edge.
Edge is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version ("the GPL").

**If you wish to use Edge outside the scope of the GPL, please contact us at licensing@edge.network for details of alternative license arrangements.**

**This product may be distributed alongside other components available under different licenses (which may not be GPL). See those components themselves, or the documentation accompanying them, to determine what licenses are applicable.**

Edge is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

The GNU General Public License (GPL) is available at: https://www.gnu.org/licenses/gpl-3.0.en.html<br />
A copy can be found in the file GPL.md distributed with
these files.

This copyright notice MUST APPEAR in all copies of the product!
