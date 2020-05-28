echo npm > .config/glitch-package-manager
find node_modules/ -delete || true
jq '.dependencies.node="^14.3.0"' <package.json >package-new.json
mv package-new.json package.json
npm install -P
rm -f .env
node_modules/.bin/envfile env2json <sample.env | jq 'with_entries(.value=(.value|sub("/runtime/";"/.data/"))) | .CA_HTTP_PORT="3000"' | node_modules/.bin/envfile json2env >.env
refresh
