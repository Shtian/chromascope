# Chromascope

A CLI that captures web pages in real browsers and reports how much they differ visually, either across browsers or before and after a UI change.

## Comparisons

**Cross-browser diff**:
A comparison of one page captured in several browsers at the same moment, each measured against the base browser.
_Avoid_: browser diff, compatibility check

**Base browser**:
The browser a cross-browser diff measures every other browser against.
_Avoid_: reference browser, main browser

**Capture options**:
The settings that decide how a page is captured: which browsers, the viewport, the element, what to wait for. Shared by every command that captures a page. **Image options** are the subset that changes the image.
_Avoid_: screenshot settings, capture config

**Image options**:
The capture options that change the captured image: viewport, device scale factor, element, full page, what to wait for, and masks. A baseline stores them, and `compare` must use the same ones.
_Avoid_: image settings, screenshot options

**Before/after comparison**:
A comparison of a page captured now against its baseline, in the same browser.
_Avoid_: regression test, visual test

**URL comparison**:
A comparison of two URLs captured with the same capture options, each browser's capture of the second URL measured against its capture of the first. No baseline involved.
_Avoid_: live compare, against-compare

## Baselines

**Baseline**:
A stored capture of a page in one browser, kept with its image options as the "before" state for a later before/after comparison. Short-lived and local to one working session, never committed.
_Avoid_: snapshot (as a noun), golden image, reference image

**Baseline name**:
The identifier that groups the baselines of one page across browsers, derived from the URL and element unless given explicitly.
_Avoid_: baseline ID, key
