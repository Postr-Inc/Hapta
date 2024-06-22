echo "Build started at $(date)"
bun build --compile --sourcemap=inline --minify --target=bun-windows-x64 server.ts --outfile ./builds/windows/x64/hapta-server
bun build --compile --sourcemap=inline --minify --target=bun-linux-arm64 server.ts --outfile ./builds/linux/arm64/hapta-server
bun build --compile --sourcemap=inline --minify --target=bun-linux-x64 server.ts --outfile ./builds/linux/x64/hapta-server
bun build --compile --sourcemap=inline --minify --target=bun-darwin-arm64 server.ts --outfile ./builds/darwin/arm64/hapta-server
echo "Build completed at $(date)"
