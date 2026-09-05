import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AlertIcon,
  CheckIcon,
  FlagIcon,
  InfoIcon,
  PackageIcon,
  PlayIcon,
  RefreshIcon,
  RocketIcon,
  SettingsIcon,
  StopIcon,
  TruckIcon,
} from "./Icon";

describe("iconografía profesional de Fleet / AC-06 a AC-09", () => {
  it("renderiza iconos SVG decorativos con color heredado", () => {
    const markup = renderToStaticMarkup(
      <>
        <TruckIcon />
        <PackageIcon />
        <AlertIcon />
        <CheckIcon />
        <InfoIcon />
        <PlayIcon />
        <StopIcon />
        <RefreshIcon />
        <SettingsIcon />
        <RocketIcon />
        <FlagIcon />
      </>,
    );

    expect(markup.match(/<svg/g)).toHaveLength(11);
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(11);
    expect(markup.match(/stroke="currentColor"/g)).toHaveLength(11);
    expect(markup).toContain("fleet-icon");
  });
});
