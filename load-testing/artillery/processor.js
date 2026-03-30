/**
 * Artillery Processor - Custom Functions for Load Testing
 * Provides dynamic data generation and custom logic for test scenarios
 */

module.exports = {
  generateRandomEmail,
  generateRandomProduct,
  generateRandomOrder,
  logResponse,
  beforeRequest,
  afterResponse,
};

/**
 * Generate random email for user scenarios
 */
function generateRandomEmail(context, events, done) {
  context.vars.email = `loadtest-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
  return done();
}

/**
 * Generate random product data
 */
function generateRandomProduct(context, events, done) {
  const categories = ['electronics', 'fashion', 'home', 'sports', 'books'];
  const names = ['Premium', 'Deluxe', 'Standard', 'Basic', 'Pro'];
  const items = ['Laptop', 'Phone', 'Tablet', 'Watch', 'Camera'];
  
  context.vars.productName = `${names[Math.floor(Math.random() * names.length)]} ${items[Math.floor(Math.random() * items.length)]}`;
  context.vars.productPrice = (Math.random() * 1000 + 10).toFixed(2);
  context.vars.productCategory = categories[Math.floor(Math.random() * categories.length)];
  context.vars.productStock = Math.floor(Math.random() * 100) + 1;
  
  return done();
}

/**
 * Generate random order data
 */
function generateRandomOrder(context, events, done) {
  context.vars.orderQuantity = Math.floor(Math.random() * 5) + 1;
  context.vars.buyerId = `buyer-${Math.floor(Math.random() * 1000) + 1}`;
  
  return done();
}

/**
 * Log response for debugging
 */
function logResponse(requestParams, response, context, ee, next) {
  if (response.statusCode >= 400) {
    console.log(`Error Response: ${response.statusCode} - ${requestParams.url}`);
    if (response.body) {
      console.log(`Response Body: ${JSON.stringify(response.body).substring(0, 200)}`);
    }
  }
  return next();
}

/**
 * Before request hook - Add custom headers
 */
function beforeRequest(requestParams, context, ee, next) {
  // Add custom headers for tracking
  requestParams.headers = requestParams.headers || {};
  requestParams.headers['X-Load-Test'] = 'true';
  requestParams.headers['X-Test-Run-ID'] = context.vars.$testId || 'unknown';
  requestParams.headers['X-Virtual-User'] = context.vars.$uuid || 'unknown';
  
  return next();
}

/**
 * After response hook - Collect custom metrics
 */
function afterResponse(requestParams, response, context, ee, next) {
  // Emit custom metrics
  if (response.statusCode === 200) {
    ee.emit('counter', 'http.success', 1);
  } else if (response.statusCode >= 400 && response.statusCode < 500) {
    ee.emit('counter', 'http.client_error', 1);
  } else if (response.statusCode >= 500) {
    ee.emit('counter', 'http.server_error', 1);
  }
  
  // Track slow responses
  const responseTime = response.timings?.end || 0;
  if (responseTime > 3000) {
    ee.emit('counter', 'http.slow_response', 1);
  }
  
  return next();
}
