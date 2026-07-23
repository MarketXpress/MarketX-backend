const fs = require('node:fs');
const path = require('node:path');

const swaggerUiDist = path.dirname(require.resolve('swagger-ui-dist/package.json'));
const outputDir = path.join(process.cwd(), 'docs', 'api');
const openapiPath = path.join(outputDir, 'openapi.json');

if (!fs.existsSync(openapiPath)) {
  console.error(
    `openapi.json not found at ${openapiPath} — run "npm run docs:generate" first.`,
  );
  process.exit(1);
}

const assetsToCopy = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
  'favicon-16x16.png',
  'favicon-32x32.png',
];

for (const asset of assetsToCopy) {
  fs.copyFileSync(path.join(swaggerUiDist, asset), path.join(outputDir, asset));
}

const initializer = `window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: './openapi.json',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: 'StandaloneLayout',
  });
};
`;
fs.writeFileSync(path.join(outputDir, 'swagger-initializer.js'), initializer, 'utf-8');

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>MarketX API Docs</title>
    <link rel="stylesheet" type="text/css" href="./swagger-ui.css" />
    <link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="./favicon-16x16.png" sizes="16x16" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="./swagger-ui-bundle.js" charset="UTF-8"></script>
    <script src="./swagger-ui-standalone-preset.js" charset="UTF-8"></script>
    <script src="./swagger-initializer.js" charset="UTF-8"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');

console.log(`Static API docs rendered to ${outputDir}`);
