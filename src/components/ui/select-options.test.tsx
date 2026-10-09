import { describe, expect, it } from "vitest";
import { getOptions } from "./select-options";

describe("getOptions", () => {
  it("reads value, label and flags from option children in order", () => {
    const options = getOptions([
      <option key="a" value="a">Alfa</option>,
      <option key="b" value="b" disabled>Beta</option>,
      <option key="c" value="c" hidden>Gamma</option>,
    ]);

    expect(options).toEqual([
      { value: "a", label: "Alfa", disabled: false, hidden: false },
      { value: "b", label: "Beta", disabled: true, hidden: false },
      { value: "c", label: "Gamma", disabled: false, hidden: true },
    ]);
  });

  it("uses the label as value when the option has no value attribute", () => {
    const options = getOptions(<option>Solo texto</option>);

    expect(options).toEqual([
      { value: "Solo texto", label: "Solo texto", disabled: false, hidden: false },
    ]);
  });

  it("stringifies numeric values and flattens nested text in labels", () => {
    const options = getOptions(
      <option value={7}>
        <span>Siete</span> <strong>días</strong>
      </option>
    );

    expect(options).toEqual([
      { value: "7", label: "Siete días", disabled: false, hidden: false },
    ]);
  });

  it("ignores non-option children and loose text", () => {
    const options = getOptions([
      "texto suelto",
      <div key="d">no es opcion</div>,
      <option key="a" value="a">Alfa</option>,
    ]);

    expect(options).toEqual([
      { value: "a", label: "Alfa", disabled: false, hidden: false },
    ]);
  });

  it("returns an empty list when there are no children", () => {
    expect(getOptions(undefined)).toEqual([]);
  });
});
