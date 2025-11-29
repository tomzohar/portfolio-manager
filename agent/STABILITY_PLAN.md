# Portfolio Manager System: Stability & Infrastructure Roadmap

**Version:** 1.0  
**Date:** November 23, 2025  
**Status:** Draft

---

## Executive Summary

Following the successful implementation of the V3 Supervisor architecture and the resolution of critical logic gaps (ETF handling, Risk-Off enforcement), the next phase of development focuses on **hardening**, **scalability**, and **observability**. This document outlines the roadmap for transforming the current MVP into a robust, production-grade financial analysis platform.

---

## I. Infrastructure Modernization

### 1. Caching Layer (High Priority)
**Problem:** Repeated API calls to Polygon/FMP for the same tickers increase latency and hit rate limits.  
**Solution:** Implement Redis-based caching.
- **Short-term (In-Memory):** Use `functools.lru_cache` for single-run efficiency (already partially in place).
- **Long-term (Persistent):** 
  - Deploy Redis instance.
  - Cache fundamental data (TTL: 24h) and financial statements (TTL: 30 days).
  - Cache technical indicators (TTL: 1h).

### 2. Data Persistence
**Problem:** State is transient; historical analysis is lost after execution.  
**Solution:** Introduce a dedicated database.
- **Technology:** PostgreSQL with TimescaleDB extension (optimized for time-series financial data).
- **Schema:**
  - `analyses`: Store full JSON reports and metadata.
  - `market_data`: Store normalized OHLCV and indicators.
  - `audit_logs`: Track agent decisions and reflexion feedback for compliance.

### 3. Asynchronous Execution
**Problem:** Sequential processing of tickers (even with batching) limits scalability.  
**Solution:** Task Queue Architecture.
- **Tools:** Celery + RabbitMQ / Redis.
- **Flow:**
  1. User request -> API Endpoint -> Enqueue Task.
  2. Worker Pool picks up task -> Runs LangGraph workflow.
  3. Result -> Webhook / Pushover / Database.

---

## II. Monitoring & Observability

### 1. Enhanced Error Tracking
- **Sentry:** Deepen integration to capture:
  - Contextual agent state at failure (inputs, scratchpad).
  - API latency and timeouts.
  - Token usage per run.

### 2. Performance Dashboard
**Goal:** Real-time visibility into system health.
- **Metrics to Track:**
  - Average analysis time per ticker.
  - API error rates (Polygon vs FMP vs FRED).
  - Confidence score trends over time.
  - Reflexion rejection rates (measure of agent alignment).
- **Implementation:** Streamlit or Grafana dashboard connected to the PostgreSQL DB.

---

## III. Testing & Quality Assurance

### 1. Expanded Integration Suite
- **Real-World Scenarios:**
  - "Market Crash" simulation (mocked -50% prices).
  - "Data Blackout" simulation (all APIs fail).
  - "Contradictory Data" simulation (Fundamentals say Buy, Technicals say Strong Sell).
- **Property-Based Testing:** Use `hypothesis` library to fuzz test risk calculations with extreme inputs.

### 2. CI/CD Pipeline
- **GitHub Actions:**
  - Run unit tests on every push.
  - Run integration tests (mocked) on PRs.
  - Run full E2E tests (live API) on merge to main (weekly schedule).
- **Linting:** Enforce `mypy` (strict mode), `ruff`, and `black`.

---

## IV. Future Feature Roadmap (Post-Stabilization)

1. **Portfolio Optimization Engine:**
   - Implement Mean-Variance Optimization (MVO) or Black-Litterman model.
   - Auto-rebalancing suggestions based on target weights.

2. **Multi-Modal Inputs:**
   - Ingest PDF earnings reports directly.
   - Parse earnings call transcripts for sentiment.

3. **User Customization:**
   - Configurable risk profiles (Aggressive, Moderate, Conservative).
   - Custom "Watchlist" constraints (e.g., "No Crypto", "ESG Only").

---

## V. Immediate Action Items (Next 2 Weeks)

1. [ ] **Dockerize Application:** Create `Dockerfile` and `docker-compose.yml` for consistent dev/prod environments.
2. [ ] **Implement Caching:** Add basic file-based or Redis caching for FMP/Polygon calls.
3. [ ] **Refactor Configuration:** Move all hardcoded thresholds (e.g., Beta > 1.0) to `config.py`.
4. [ ] **Database Migration:** Design initial PostgreSQL schema for storing reports.

---

