import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Removal of F1 details from Build and Ask", () => {
  const scriptContent = fs.readFileSync(path.resolve("public/script.js"), "utf8");
  const styleContent = fs.readFileSync(path.resolve("public/style.css"), "utf8");

  it("1. Loading title and subtext do not contain F1 racing theme", () => {
    // F1 phrases must not be present
    assert.doesNotMatch(scriptContent, /Analyzing your brief at top speed/);
    assert.doesNotMatch(scriptContent, /Generating your brief at top speed/);
    assert.doesNotMatch(scriptContent, /record lap time/);
    assert.doesNotMatch(scriptContent, /maksimum sürətlə/);
    assert.doesNotMatch(scriptContent, /rekord dövrə/);

    // Standard strategic titles must be preserved
    assert.match(scriptContent, /Analyzing your brief/);
    assert.match(scriptContent, /Building your execution roadmap/);
  });

  it("2. F1 wheel/tire spinner loader is removed from script.js and style.css", () => {
    assert.doesNotMatch(scriptContent, /f1-wheel-loader-container/);
    assert.doesNotMatch(scriptContent, /f1-tire-spinner/);
    assert.doesNotMatch(styleContent, /@keyframes f1TireSpin/);
    assert.doesNotMatch(styleContent, /\.f1-tire-spinner/);
    assert.doesNotMatch(styleContent, /\.f1-wheel-loader-container/);
  });

  it("3. F1 start lights countdown gantry is removed from script.js and style.css", () => {
    assert.doesNotMatch(scriptContent, /function createF1StartCountdown/);
    assert.doesNotMatch(scriptContent, /f1-start-gantry-card/);
    assert.doesNotMatch(scriptContent, /f1-gantry-lights-bar/);
    assert.doesNotMatch(scriptContent, /f1-light-pod/);
    assert.doesNotMatch(scriptContent, /shouldShowF1Countdown/);
    assert.doesNotMatch(scriptContent, /waitForF1Countdown/);
    assert.doesNotMatch(styleContent, /\.f1-start-gantry-card/);
  });

  it("4. F1 car flyby transition is removed from script.js and style.css", () => {
    assert.doesNotMatch(scriptContent, /function playF1CarTransition/);
    assert.doesNotMatch(scriptContent, /f1-car-flyby-overlay/);
    assert.doesNotMatch(scriptContent, /f1-car-flyby-vehicle/);
    assert.doesNotMatch(scriptContent, /f1-trail-line/);
    assert.doesNotMatch(styleContent, /\.f1-car-flyby-overlay/);
    assert.doesNotMatch(styleContent, /@keyframes f1FlybyTrajectory/);
  });

  it("5. Ask and Build send buttons do not contain F1 icon or F1 launch animation", () => {
    // F1 icon and launch animation are completely removed
    assert.doesNotMatch(scriptContent, /ask-f1-icon/);
    assert.doesNotMatch(scriptContent, /triggerF1Launch/);
    assert.doesNotMatch(styleContent, /\.ask-f1-icon/);
    assert.doesNotMatch(styleContent, /@keyframes f1-launch/);

    // createAskSendIcon returns a clean arrow submit icon
    assert.match(scriptContent, /function createAskSendIcon\(\)/);
    assert.match(scriptContent, /ask-submit-icon/);
  });
});
