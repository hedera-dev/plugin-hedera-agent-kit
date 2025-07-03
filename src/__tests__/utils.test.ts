import { describe, expect, it } from "bun:test";
import {
  convertTimestampToUTC,
  generateHashscanUrl,
  convertStringToTimestamp,
  castToBoolean,
  castToNull,
  castToEmptyString,
  toBaseUnitSync,
} from "../shared/utils";
import BigNumber from "bignumber.js";

describe("Utility Functions", () => {
  describe("convertTimestampToUTC", () => {
    it("should convert Hedera timestamp to UTC", () => {
      const timestamp = "1672531200.123456789";
      const result = convertTimestampToUTC(timestamp);

      expect(result).toBeDefined();
      expect(result).toContain("2023-01-01");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should handle timestamps with zero nanoseconds", () => {
      const timestamp = "1672531200.000000000";
      const result = convertTimestampToUTC(timestamp);

      expect(result).toBeDefined();
      expect(result).toContain("2023-01-01");
    });
  });

  describe("generateHashscanUrl", () => {
    it("should generate mainnet URL", () => {
      const txHash = "0.0.123@456.789";
      const url = generateHashscanUrl(txHash, "mainnet");

      expect(url).toBe("https://hashscan.io/mainnet/tx/0.0.123@456.789");
    });

    it("should generate testnet URL", () => {
      const txHash = "0.0.123@456.789";
      const url = generateHashscanUrl(txHash, "testnet");

      expect(url).toBe("https://hashscan.io/testnet/tx/0.0.123@456.789");
    });

    it("should generate previewnet URL", () => {
      const txHash = "0.0.123@456.789";
      const url = generateHashscanUrl(txHash, "previewnet");

      expect(url).toBe("https://hashscan.io/previewnet/tx/0.0.123@456.789");
    });
  });

  describe("convertStringToTimestamp", () => {
    it("should convert ISO date string to timestamp", () => {
      const dateString = "2023-01-01T00:00:00.000Z";
      const result = convertStringToTimestamp(dateString);

      expect(result).toBeDefined();
      expect(typeof result).toBe("number");
      expect(result).toBe(1672531200);
    });

    it("should throw error for invalid date format", () => {
      expect(() => {
        convertStringToTimestamp("invalid-date");
      }).toThrow("Invalid date format");
    });
  });

  describe("castToBoolean", () => {
    it("should convert string 'true' to boolean true", () => {
      const result = castToBoolean.parse("true");
      expect(result).toBe(true);
    });

    it("should convert string 'false' to boolean false", () => {
      const result = castToBoolean.parse("false");
      expect(result).toBe(false);
    });

    it("should convert string 'TRUE' to boolean true", () => {
      const result = castToBoolean.parse("TRUE");
      expect(result).toBe(true);
    });

    it("should convert any other string to false", () => {
      const result = castToBoolean.parse("anything");
      expect(result).toBe(false);
    });

    it("should pass through boolean values", () => {
      expect(castToBoolean.parse(true)).toBe(true);
      expect(castToBoolean.parse(false)).toBe(false);
    });
  });

  describe("castToNull", () => {
    it("should convert string 'null' to null", () => {
      const result = castToNull("null");
      expect(result).toBeNull();
    });

    it("should pass through other values", () => {
      expect(castToNull("test")).toBe("test");
      expect(castToNull(123)).toBe(123);
      expect(castToNull(null)).toBeNull();
    });
  });

  describe("castToEmptyString", () => {
    it("should convert string 'null' to empty string", () => {
      const result = castToEmptyString("null");
      expect(result).toBe("");
    });

    it("should pass through other values", () => {
      expect(castToEmptyString("test")).toBe("test");
      expect(castToEmptyString(123)).toBe(123);
    });
  });

  describe("toBaseUnitSync", () => {
    it("should convert value with 8 decimals", () => {
      const result = toBaseUnitSync(8, "100000000");
      expect(result.toString()).toBe("1");
    });

    it("should convert value with 18 decimals", () => {
      const result = toBaseUnitSync(18, "1000000000000000000");
      expect(result.toString()).toBe("1");
    });

    it("should handle string decimals", () => {
      const result = toBaseUnitSync("8", "100000000");
      expect(result.toString()).toBe("1");
    });

    it("should handle BigNumber input", () => {
      const value = new BigNumber("100000000");
      const result = toBaseUnitSync(8, value);
      expect(result.toString()).toBe("1");
    });

    it("should handle fractional results", () => {
      const result = toBaseUnitSync(8, "50000000");
      expect(result.toString()).toBe("0.5");
    });
  });
});

describe("Test Utility Functions", () => {
  it("should correctly extract values from hashscan links", () => {
    const {
      hashscanLinkMatcher,
      hashscanTopicLinkMatcher,
    } = require("../tests/utils/utils");

    const txLink = "https://hashscan.io/testnet/tx/0.0.123@456.789";
    const txMatch = hashscanLinkMatcher(txLink);
    expect(txMatch).toBeDefined();
    expect(txMatch[1]).toBe("0.0.123");
    expect(txMatch[2]).toBe("456.789");

    const topicLink = "https://hashscan.io/testnet/topic/0.0.456";
    const topicMatch = hashscanTopicLinkMatcher(topicLink);
    expect(topicMatch).toBeDefined();
    expect(topicMatch[1]).toBe("0.0.456");
  });

  it("should convert between tinybar and hbar", () => {
    const { fromTinybarToHbar } = require("../tests/utils/utils");

    expect(fromTinybarToHbar(100000000)).toBe(1);
    expect(fromTinybarToHbar(50000000)).toBe(0.5);
    expect(fromTinybarToHbar(250000000)).toBe(2.5);
  });

  it("should convert between base and display units", () => {
    const {
      fromBaseToDisplayUnit,
      fromDisplayToBaseUnit,
    } = require("../tests/utils/utils");

    // Test base to display
    expect(fromBaseToDisplayUnit(1000000, 6)).toBe(1);
    expect(fromBaseToDisplayUnit(500000, 6)).toBe(0.5);

    // Test display to base
    expect(fromDisplayToBaseUnit(1, 6)).toBe(1000000);
    expect(fromDisplayToBaseUnit(0.5, 6)).toBe(500000);
  });
});
