/* eslint-env jest */
const path = require("path");
const fs = require("fs");
const os = require("os");

// Use a temp directory for cache so tests are isolated
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "modelmap-test-"));
process.env.STORAGE_DIR = tmpDir;

// Prevent actual network calls during tests
global.fetch = jest.fn().mockResolvedValue({
  status: 200,
  json: async () => ({}),
});

// Reset singleton between tests
beforeEach(() => {
  jest.resetModules();
  // Clear cached module so the singleton is re-created per test
  delete require.cache[
    require.resolve(
      "../../../../utils/AiProviders/modelMap/index"
    )
  ];
  // Remove any cache files written in previous tests
  const cacheDir = path.join(tmpDir, "models", "context-windows");
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("Mrl_ContextWindowFinder (MODEL_MAP)", () => {
  test("exports MODEL_MAP singleton", () => {
    const { MODEL_MAP } = require("../../../../utils/AiProviders/modelMap/index");
    expect(MODEL_MAP).toBeDefined();
    expect(typeof MODEL_MAP.get).toBe("function");
  });

  test("returns null for missing provider when no cache exists", () => {
    const { MODEL_MAP } = require("../../../../utils/AiProviders/modelMap/index");
    const result = MODEL_MAP.get(null, null);
    expect(result).toBeNull();
  });

  test("falls back to legacy model map when cache file is absent", () => {
    const LEGACY_MODEL_MAP = require("../../../../utils/AiProviders/modelMap/legacy");
    const { MODEL_MAP } = require("../../../../utils/AiProviders/modelMap/index");

    // Pick a known provider/model from the legacy map
    const [provider] = Object.keys(LEGACY_MODEL_MAP);
    const [model, contextWindow] = Object.entries(LEGACY_MODEL_MAP[provider])[0];

    const result = MODEL_MAP.get(provider, model);
    expect(result).toBe(contextWindow);
  });

  test("returns full provider map when model is not specified", () => {
    const LEGACY_MODEL_MAP = require("../../../../utils/AiProviders/modelMap/legacy");
    const { MODEL_MAP } = require("../../../../utils/AiProviders/modelMap/index");

    const [provider] = Object.keys(LEGACY_MODEL_MAP);
    const result = MODEL_MAP.get(provider);
    expect(result).toEqual(LEGACY_MODEL_MAP[provider]);
  });

  test("returns null for unknown provider", () => {
    const { MODEL_MAP } = require("../../../../utils/AiProviders/modelMap/index");
    const result = MODEL_MAP.get("unknown-provider-xyz", "some-model");
    expect(result).toBeNull();
  });

  test("returns null for known provider but unknown model", () => {
    const LEGACY_MODEL_MAP = require("../../../../utils/AiProviders/modelMap/legacy");
    const { MODEL_MAP } = require("../../../../utils/AiProviders/modelMap/index");

    const [provider] = Object.keys(LEGACY_MODEL_MAP);
    const result = MODEL_MAP.get(provider, "non-existent-model-xyz");
    expect(result).toBeNull();
  });

  test("uses cached model map when cache file exists", () => {
    const cacheDir = path.join(tmpDir, "models", "context-windows");
    fs.mkdirSync(cacheDir, { recursive: true });

    const fakeCache = {
      anthropic: { "claude-custom-test": 999999 },
    };
    fs.writeFileSync(
      path.join(cacheDir, "context-windows.json"),
      JSON.stringify(fakeCache)
    );
    fs.writeFileSync(
      path.join(cacheDir, ".cached_at"),
      Date.now().toString()
    );

    const { MODEL_MAP } = require("../../../../utils/AiProviders/modelMap/index");
    const result = MODEL_MAP.get("anthropic", "claude-custom-test");
    expect(result).toBe(999999);
  });

  test("isCacheStale returns true when expiry file is missing", () => {
    const { MODEL_MAP } = require("../../../../utils/AiProviders/modelMap/index");
    expect(MODEL_MAP.isCacheStale).toBe(true);
  });

  test("isCacheStale returns false for a fresh cache file", () => {
    const cacheDir = path.join(tmpDir, "models", "context-windows");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, ".cached_at"),
      Date.now().toString()
    );

    const { MODEL_MAP } = require("../../../../utils/AiProviders/modelMap/index");
    expect(MODEL_MAP.isCacheStale).toBe(false);
  });

  test("isCacheStale returns true when cached_at is old", () => {
    const cacheDir = path.join(tmpDir, "models", "context-windows");
    fs.mkdirSync(cacheDir, { recursive: true });
    // Write a timestamp older than 3 days
    const oldTimestamp = Date.now() - 1000 * 60 * 60 * 24 * 4; // 4 days ago
    fs.writeFileSync(
      path.join(cacheDir, ".cached_at"),
      oldTimestamp.toString()
    );

    const { MODEL_MAP } = require("../../../../utils/AiProviders/modelMap/index");
    expect(MODEL_MAP.isCacheStale).toBe(true);
  });
});
