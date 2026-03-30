#!/bin/bash

###############################################################################
# K6 Load Test Runner Script
# 
# This script runs K6 load tests with proper configuration and
# generates comprehensive reports.
#
# Usage:
#   ./run-k6.sh [options]
#
# Options:
#   -t, --target URL    Target URL (default: http://localhost:3000)
#   -v, --vus NUM       Number of virtual users (default: 200)
#   -d, --duration TIME Duration (default: 5m)
#   -e, --env FILE      Environment file (default: .env.load-test)
#   -o, --output DIR    Output directory (default: ./load-testing/reports)
#   -h, --help          Show this help message
###############################################################################

set -e

# Default values
TARGET_URL="${TARGET_URL:-http://localhost:3000}"
VUS="${K6_VUS:-200}"
DURATION="${K6_DURATION:-5m}"
ENV_FILE=".env.load-test"
OUTPUT_DIR="./load-testing/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="${OUTPUT_DIR}/k6-results-${TIMESTAMP}.json"
SUMMARY_FILE="${OUTPUT_DIR}/k6-summary-${TIMESTAMP}.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--target)
      TARGET_URL="$2"
      shift 2
      ;;
    -v|--vus)
      VUS="$2"
      shift 2
      ;;
    -d|--duration)
      DURATION="$2"
      shift 2
      ;;
    -e|--env)
      ENV_FILE="$2"
      shift 2
      ;;
    -o|--output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      grep '^#' "$0" | tail -n +3 | head -n -1 | cut -c 3-
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Print banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            K6 Load Testing - MarketX Backend              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Load environment variables if file exists
if [ -f "$ENV_FILE" ]; then
  echo -e "${GREEN}✓ Loading environment from: ${ENV_FILE}${NC}"
  export $(grep -v '^#' "$ENV_FILE" | xargs)
else
  echo -e "${YELLOW}⚠ Environment file not found: ${ENV_FILE}${NC}"
  echo -e "${YELLOW}  Using default configuration${NC}"
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Check if K6 is installed
if ! command -v k6 &> /dev/null; then
  echo -e "${RED}✗ K6 is not installed${NC}"
  echo -e "${YELLOW}  Install from: https://k6.io/docs/getting-started/installation/${NC}"
  exit 1
fi

echo -e "${GREEN}✓ K6 version: $(k6 version)${NC}"

# Verify target is reachable
echo -e "\n${BLUE}Checking target availability...${NC}"
if curl -s --head --request GET "$TARGET_URL" | grep "200\|404\|401" > /dev/null; then
  echo -e "${GREEN}✓ Target is reachable: ${TARGET_URL}${NC}"
else
  echo -e "${RED}✗ Target is not reachable: ${TARGET_URL}${NC}"
  echo -e "${YELLOW}  Make sure your application is running${NC}"
  exit 1
fi

# Display test configuration
echo -e "\n${BLUE}Test Configuration:${NC}"
echo -e "  Target URL:      ${TARGET_URL}"
echo -e "  Virtual Users:   ${VUS}"
echo -e "  Duration:        ${DURATION}"
echo -e "  Config File:     ./load-testing/k6/load-test.js"
echo -e "  Results File:    ${RESULTS_FILE}"
echo -e "  Summary File:    ${SUMMARY_FILE}"
echo -e "  Timestamp:       ${TIMESTAMP}"

# Confirm before running
echo -e "\n${YELLOW}Press Enter to start the load test, or Ctrl+C to cancel...${NC}"
read -r

# Run K6 test
echo -e "\n${BLUE}Starting K6 load test...${NC}"
echo -e "${YELLOW}This will take approximately 7 minutes (1m warmup + 5m peak + 1m cooldown)${NC}\n"

TARGET_URL="$TARGET_URL" \
ENVIRONMENT="${ENVIRONMENT:-staging}" \
k6 run \
  --out json="$RESULTS_FILE" \
  --summary-export="$SUMMARY_FILE" \
  ./load-testing/k6/load-test.js

# Check if test completed successfully
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}✓ Load test completed successfully${NC}"
  
  # Display summary
  echo -e "\n${BLUE}Test Summary:${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  # Extract key metrics from summary
  if [ -f "$SUMMARY_FILE" ] && command -v jq &> /dev/null; then
    echo -e "\n${BLUE}Key Metrics:${NC}"
    jq -r '
      .metrics |
      "  Total Requests:     \(.http_reqs.values.count // 0)",
      "  Request Rate:       \(.http_reqs.values.rate // 0 | tonumber | floor) req/s",
      "  Failed Requests:    \(.http_req_failed.values.passes // 0)",
      "  Avg Response Time:  \(.http_req_duration.values.avg // 0 | tonumber | floor)ms",
      "  P95 Response Time:  \(.http_req_duration.values["p(95)"] // 0 | tonumber | floor)ms",
      "  P99 Response Time:  \(.http_req_duration.values["p(99)"] // 0 | tonumber | floor)ms",
      "  Error Rate:         \((.errors.values.rate // 0) * 100 | tonumber | floor)%",
      "  Heavy Queries:      \(.heavy_query_count.values.count // 0)"
    ' "$SUMMARY_FILE" 2>/dev/null || echo -e "${YELLOW}  (Install jq for detailed metrics)${NC}"
    
    # Check thresholds
    echo -e "\n${BLUE}Threshold Status:${NC}"
    jq -r '
      .metrics |
      if .http_req_duration.values["p(95)"] < 2000 then
        "  ✓ P95 Response Time: PASS"
      else
        "  ✗ P95 Response Time: FAIL"
      end,
      if .http_req_duration.values["p(99)"] < 5000 then
        "  ✓ P99 Response Time: PASS"
      else
        "  ✗ P99 Response Time: FAIL"
      end,
      if (.errors.values.rate // 0) < 0.05 then
        "  ✓ Error Rate: PASS"
      else
        "  ✗ Error Rate: FAIL"
      end
    ' "$SUMMARY_FILE" 2>/dev/null
  fi
  
  echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  # Performance analysis
  echo -e "\n${BLUE}Performance Analysis:${NC}"
  
  if [ -f "$SUMMARY_FILE" ] && command -v jq &> /dev/null; then
    P95=$(jq -r '.metrics.http_req_duration.values["p(95)"]' "$SUMMARY_FILE" 2>/dev/null)
    ERROR_RATE=$(jq -r '(.metrics.errors.values.rate // 0) * 100' "$SUMMARY_FILE" 2>/dev/null)
    
    if (( $(echo "$P95 < 1000" | bc -l) )); then
      echo -e "  ${GREEN}✓ Excellent performance - System handles load well${NC}"
    elif (( $(echo "$P95 < 2000" | bc -l) )); then
      echo -e "  ${YELLOW}⚠ Good performance - Minor optimizations recommended${NC}"
    else
      echo -e "  ${RED}✗ Poor performance - Significant optimizations needed${NC}"
    fi
    
    if (( $(echo "$ERROR_RATE < 1" | bc -l) )); then
      echo -e "  ${GREEN}✓ Low error rate - System is stable${NC}"
    elif (( $(echo "$ERROR_RATE < 5" | bc -l) )); then
      echo -e "  ${YELLOW}⚠ Moderate error rate - Investigation recommended${NC}"
    else
      echo -e "  ${RED}✗ High error rate - Immediate attention required${NC}"
    fi
  fi
  
  # Bottleneck detection
  echo -e "\n${BLUE}Potential Bottlenecks:${NC}"
  if [ -f "$SUMMARY_FILE" ] && command -v jq &> /dev/null; then
    jq -r '
      .metrics |
      if .product_query_duration.values["p(95)"] > 2500 then
        "  ⚠ Product queries are slow - Consider database indexing"
      else empty end,
      if .order_query_duration.values["p(95)"] > 2000 then
        "  ⚠ Order queries are slow - Optimize query filters"
      else empty end,
      if .analytics_query_duration.values["p(95)"] > 3000 then
        "  ⚠ Analytics queries are slow - Consider caching or pre-aggregation"
      else empty end,
      if .memory_pressure_indicator.values.value > 0.5 then
        "  ⚠ Memory pressure detected - Monitor memory usage"
      else empty end
    ' "$SUMMARY_FILE" 2>/dev/null || echo -e "  ${GREEN}✓ No obvious bottlenecks detected${NC}"
  fi
  
  echo -e "\n${BLUE}Next Steps:${NC}"
  echo -e "  1. Review detailed results: ${RESULTS_FILE}"
  echo -e "  2. Analyze summary metrics: ${SUMMARY_FILE}"
  echo -e "  3. Identify performance bottlenecks"
  echo -e "  4. Monitor system resources (CPU, memory, database)"
  echo -e "  5. Implement optimizations (indexing, caching, etc.)"
  echo -e "  6. Re-run tests to validate improvements"
  
  # Generate recommendations
  echo -e "\n${BLUE}Recommendations:${NC}"
  if [ -f "$SUMMARY_FILE" ] && command -v jq &> /dev/null; then
    HEAVY_QUERIES=$(jq -r '.metrics.heavy_query_count.values.count // 0' "$SUMMARY_FILE" 2>/dev/null)
    echo -e "  • Total heavy queries executed: ${HEAVY_QUERIES}"
    echo -e "  • Focus optimization efforts on high-weight scenarios (Products: 40%, Orders: 30%)"
    echo -e "  • Review database query plans for filtered queries"
    echo -e "  • Consider implementing Redis caching for frequently accessed data"
    echo -e "  • Monitor database connection pool utilization"
  fi
  
else
  echo -e "\n${RED}✗ Load test failed${NC}"
  echo -e "${YELLOW}  Check the logs above for error details${NC}"
  exit 1
fi

echo -e "\n${GREEN}✓ All done!${NC}\n"
