#!/bin/bash

###############################################################################
# Artillery Load Test Runner Script
# 
# This script runs Artillery load tests with proper configuration and
# generates comprehensive reports.
#
# Usage:
#   ./run-artillery.sh [options]
#
# Options:
#   -t, --target URL    Target URL (default: http://localhost:3000)
#   -e, --env FILE      Environment file (default: .env.load-test)
#   -o, --output DIR    Output directory (default: ./load-testing/reports)
#   -h, --help          Show this help message
###############################################################################

set -e

# Default values
TARGET_URL="${TARGET_URL:-http://localhost:3000}"
ENV_FILE=".env.load-test"
OUTPUT_DIR="./load-testing/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="${OUTPUT_DIR}/artillery-results-${TIMESTAMP}.json"
REPORT_FILE="${OUTPUT_DIR}/artillery-report-${TIMESTAMP}.html"

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
echo "║         Artillery Load Testing - MarketX Backend          ║"
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

# Check if Artillery is installed
if ! command -v artillery &> /dev/null; then
  echo -e "${RED}✗ Artillery is not installed${NC}"
  echo -e "${YELLOW}  Install with: npm install -g artillery${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Artillery version: $(artillery version)${NC}"

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
echo -e "  Config File:     ./load-testing/artillery/load-test.yml"
echo -e "  Results File:    ${RESULTS_FILE}"
echo -e "  Report File:     ${REPORT_FILE}"
echo -e "  Timestamp:       ${TIMESTAMP}"

# Confirm before running
echo -e "\n${YELLOW}Press Enter to start the load test, or Ctrl+C to cancel...${NC}"
read -r

# Run Artillery test
echo -e "\n${BLUE}Starting Artillery load test...${NC}"
echo -e "${YELLOW}This will take approximately 7 minutes (1m warmup + 5m peak + 1m cooldown)${NC}\n"

TARGET_URL="$TARGET_URL" artillery run \
  --output "$RESULTS_FILE" \
  ./load-testing/artillery/load-test.yml

# Check if test completed successfully
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}✓ Load test completed successfully${NC}"
  
  # Generate HTML report
  echo -e "\n${BLUE}Generating HTML report...${NC}"
  artillery report "$RESULTS_FILE" --output "$REPORT_FILE"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Report generated: ${REPORT_FILE}${NC}"
    
    # Display summary
    echo -e "\n${BLUE}Test Summary:${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Extract key metrics from results
    if command -v jq &> /dev/null; then
      echo -e "\n${BLUE}Key Metrics:${NC}"
      jq -r '
        .aggregate | 
        "  Total Requests:     \(.requestsCompleted // 0)",
        "  Failed Requests:    \(.errors // 0)",
        "  Request Rate:       \(.rps.mean // 0 | tonumber | floor) req/s",
        "  Avg Response Time:  \(.latency.mean // 0 | tonumber | floor)ms",
        "  P95 Response Time:  \(.latency.p95 // 0 | tonumber | floor)ms",
        "  P99 Response Time:  \(.latency.p99 // 0 | tonumber | floor)ms"
      ' "$RESULTS_FILE" 2>/dev/null || echo -e "${YELLOW}  (Install jq for detailed metrics)${NC}"
    fi
    
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "\n${BLUE}Next Steps:${NC}"
    echo -e "  1. Open the HTML report: ${REPORT_FILE}"
    echo -e "  2. Analyze performance bottlenecks"
    echo -e "  3. Review error patterns"
    echo -e "  4. Compare with baseline metrics"
    echo -e "  5. Document findings and optimizations"
    
    # Open report in browser (optional)
    if command -v xdg-open &> /dev/null; then
      echo -e "\n${YELLOW}Open report in browser? (y/n)${NC}"
      read -r response
      if [[ "$response" =~ ^[Yy]$ ]]; then
        xdg-open "$REPORT_FILE"
      fi
    fi
  else
    echo -e "${RED}✗ Failed to generate report${NC}"
    exit 1
  fi
else
  echo -e "\n${RED}✗ Load test failed${NC}"
  echo -e "${YELLOW}  Check the logs above for error details${NC}"
  exit 1
fi

echo -e "\n${GREEN}✓ All done!${NC}\n"
