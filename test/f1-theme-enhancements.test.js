import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("F1 Grand Prix Theme Enhancements (Brief Loading & Results Transition)", () => {
  const scriptContent = fs.readFileSync(path.resolve("public/script.js"), "utf8");
  const styleContent = fs.readFileSync(path.resolve("public/style.css"), "utf8");

  it("1. Requirement 1: script.js updates loading title and subtext to F1 theme", () => {
    // Title matches "Analyzing your brief at top speed" and "Generating your brief at top speed"
    assert.match(scriptContent, /Analyzing your brief at top speed/);
    assert.match(scriptContent, /Generating your brief at top speed/);

    // Subtext matches "Synthesizing your input to tailor strategic recommendations in record lap time."
    assert.match(scriptContent, /Synthesizing your input to tailor strategic recommendations in record lap time\./);
  });

  it("2. Requirement 2: script.js and style.css implement clean minimalist vector 5-spoke F1 wheel loader", () => {
    // Clean minimalist vector F1 wheel/tire SVG with 5 spokes, center nut, and no half-circle dasharray
    assert.match(scriptContent, /f1-wheel-loader-container/);
    assert.match(scriptContent, /class="[^"]*f1-tire-spinner/);
    assert.match(scriptContent, /animation-duration:\s*0\.7s/);
    assert.match(scriptContent, /M12 3V7\.5/);
    assert.match(scriptContent, /<circle cx="12" cy="12" r="1\.5" fill="currentColor"/);
    assert.doesNotMatch(scriptContent, /stroke-dasharray="12 28"/);

    // CSS defines high speed continuous clockwise rotation keyframe at 0.7s
    assert.match(styleContent, /@keyframes f1TireSpin\s*\{/);
    assert.match(styleContent, /transform:\s*rotate\(360deg\)/);
    assert.match(styleContent, /\.f1-tire-spinner\s*\{[^}]*animation:\s*f1TireSpin 0\.7s linear infinite/);
  });

  it("3. Requirement 3: script.js and style.css implement 5-second F1 start lights countdown gantry with single-run guard", () => {
    // Function exists and generates 5 light pods
    assert.match(scriptContent, /function createF1StartCountdown\(/);
    assert.match(scriptContent, /f1-start-gantry-card/);
    assert.match(scriptContent, /f1-gantry-lights-bar/);
    assert.match(scriptContent, /f1-light-pod/);

    // Guard prevents re-running countdown on clarification or re-mount
    assert.match(scriptContent, /function shouldShowF1Countdown\(\)/);
    assert.match(scriptContent, /state\.answers\.length > 0/);
    assert.match(scriptContent, /state\.round > 0/);
    assert.match(scriptContent, /sessionStorage\.getItem\("hasSeenF1Countdown"\)/);

    // Countdown logic includes Lights Out and automatic progression
    assert.match(scriptContent, /LIGHTS OUT!/);
    assert.match(scriptContent, /waitForF1Countdown/);
    assert.match(scriptContent, /startPhaseProgress/);

    // CSS defines gantry layout, lit red pods and lights-out state
    assert.match(styleContent, /\.f1-start-gantry-card\s*\{/);
    assert.match(styleContent, /\.f1-light-pod\.is-lit \.f1-light-bulb\s*\{/);
    assert.match(styleContent, /#e10600/);
    assert.match(styleContent, /\.f1-start-gantry-card\.is-lights-out\s*\{/);
    assert.match(styleContent, /\.loading-activity\.is-staging/);
  });

  it("4. Requirement 4: script.js and style.css implement F1 car flyby transition into workspace", () => {
    // Function exists with DOM unmounting
    assert.match(scriptContent, /function playF1CarTransition\(/);
    assert.match(scriptContent, /f1-car-flyby-overlay/);
    assert.match(scriptContent, /f1-car-flyby-vehicle/);
    assert.match(scriptContent, /f1-trail-line/);
    assert.match(scriptContent, /overlay\.remove\(\)/);

    // Triggered on workspace render when strategy is completed
    assert.match(scriptContent, /state\.shouldTriggerCarTransition/);
    assert.match(scriptContent, /playF1CarTransition\(\)/);

    // CSS defines trajectory from bottom-right to top-left with non-blocking pointer events
    assert.match(styleContent, /\.f1-car-flyby-overlay\s*\{[^}]*pointer-events:\s*none;[^}]*z-index:\s*99999;/);
    assert.match(styleContent, /@keyframes f1FlybyTrajectory\s*\{/);
    assert.match(styleContent, /translate3d\(240px,\s*120px,\s*0\)\s*rotate\(-143deg\)/);
    assert.match(styleContent, /translate3d\(calc\(-100vw - 320px\),\s*calc\(-100vh - 240px\),\s*0\)\s*rotate\(-143deg\)/);
  });

  it("5. Responsive and accessibility parity for F1 elements", () => {
    // Media queries for mobile and reduced motion
    assert.match(styleContent, /@media \(max-width: 640px\)[\s\S]*?\.f1-start-gantry-card/);
    assert.match(styleContent, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.f1-tire-spinner/);
    assert.match(styleContent, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.f1-car-flyby-stage/);
  });
});
