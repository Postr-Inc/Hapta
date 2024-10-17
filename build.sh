echo "Build started at $(date)"
bun build --compile --sourcemap=inline --minify --target=bun-windows-x64 src/index.ts --outfile ./builds/windows.x64/x64/hapta-server
bun build --compile --sourcemap=inline --minify --target=bun-linux-arm64 src/index.ts --outfile ./builds/linux.arm64.x64/arm64/hapta-server 
bun build --compile --sourcemap=inline --minify --target=bun-darwin-x64 src/index.ts --outfile ./builds/darwin/arm64/hapta-server
bun build --compile --sourcemap=inline --minify --target=bun-linux-x64 src/index.ts --outfile ./builds/linux.arm64.x64/x64/hapta-server
echo "Build completed at $(date)"