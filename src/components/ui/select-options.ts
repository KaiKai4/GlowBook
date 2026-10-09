import { Children, isValidElement, type OptionHTMLAttributes, type ReactElement, type ReactNode } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled: boolean;
  hidden: boolean;
}

/** Convierte los `<option>` hijos de Select en opciones planas, en orden. */
export function getOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type !== "option") return [];

    const option = child as ReactElement<OptionHTMLAttributes<HTMLOptionElement>>;
    const label = nodeToText(option.props.children);
    const value = option.props.value !== undefined ? String(option.props.value) : label;

    return [
      {
        value,
        label,
        disabled: Boolean(option.props.disabled),
        hidden: Boolean(option.props.hidden),
      },
    ];
  });
}

function nodeToText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeToText(node.props.children);
  return "";
}
