const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

module.exports = function setupSwagger(app) {
  const specPath = path.join(__dirname, '../openapi/openapi.yaml');
  const openapiSpec = YAML.load(specPath);

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { explorer: true }));

  // 선택: 헬스가 없다면 간단히 추가(이미 있으면 이 블록은 실행되지 않음)
  if (!app._router?.stack?.some(l => l.route && l.route.path === '/health')) {
    app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
  }

  console.log('Swagger UI mounted at /docs');
}