import { DatasetRow, DatasetScalar } from "../dataset";
import { TransformExecutionError } from "./types";

type FormulaValue = string | number | boolean | null;

type Token =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "null" }
  | { type: "field"; value: string }
  | { type: "operator"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "question" }
  | { type: "colon" };

type ExpressionNode =
  | { type: "literal"; value: FormulaValue }
  | { type: "field"; name: string }
  | { type: "unary"; operator: "-" | "!"; argument: ExpressionNode }
  | { type: "binary"; operator: string; left: ExpressionNode; right: ExpressionNode }
  | { type: "conditional"; test: ExpressionNode; consequent: ExpressionNode; alternate: ExpressionNode };

const BINARY_PRECEDENCE: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  ">": 4,
  ">=": 4,
  "<": 4,
  "<=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
};

export function evaluateCalculatedExpression(expression: string, row: DatasetRow): DatasetScalar {
  const tokens = tokenize(expression);
  const parser = new Parser(tokens);
  const ast = parser.parseExpression();

  if (!parser.isAtEnd()) {
    throw new TransformExecutionError("Calculated field expression contains unexpected trailing tokens.");
  }

  return evaluateNode(ast, row);
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parseExpression(minPrecedence = 0): ExpressionNode {
    let left = this.parseUnary();

    while (true) {
      const next = this.peek();

      if (!next || next.type !== "operator") {
        break;
      }

      const precedence = BINARY_PRECEDENCE[next.value];

      if (precedence === undefined || precedence < minPrecedence) {
        break;
      }

      this.index += 1;
      const right = this.parseExpression(precedence + 1);
      left = {
        type: "binary",
        operator: next.value,
        left,
        right,
      };
    }

    if (minPrecedence === 0 && this.match("question")) {
      const consequent = this.parseExpression();
      this.expect("colon");
      const alternate = this.parseExpression();
      left = {
        type: "conditional",
        test: left,
        consequent,
        alternate,
      };
    }

    return left;
  }

  isAtEnd(): boolean {
    return this.index >= this.tokens.length;
  }

  private parseUnary(): ExpressionNode {
    const token = this.peek();

    if (token?.type === "operator" && (token.value === "-" || token.value === "!")) {
      this.index += 1;
      return {
        type: "unary",
        operator: token.value,
        argument: this.parseUnary(),
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.consume();

    if (!token) {
      throw new TransformExecutionError("Calculated field expression ended unexpectedly.");
    }

    switch (token.type) {
      case "number":
      case "string":
      case "boolean":
        return { type: "literal", value: token.value };
      case "null":
        return { type: "literal", value: null };
      case "field":
        return { type: "field", name: token.value };
      case "paren":
        if (token.value !== "(") {
          throw new TransformExecutionError("Unexpected closing parenthesis in calculated field expression.");
        }

        const expression = this.parseExpression();
        const closing = this.consume();

        if (!closing || closing.type !== "paren" || closing.value !== ")") {
          throw new TransformExecutionError("Calculated field expression is missing a closing parenthesis.");
        }

        return expression;
      default:
        throw new TransformExecutionError("Calculated field expression contains an unexpected token.");
    }
  }

  private expect(type: Token["type"]): void {
    const token = this.consume();

    if (!token || token.type !== type) {
      throw new TransformExecutionError(`Calculated field expression is missing ${type}.`);
    }
  }

  private match(type: Token["type"]): boolean {
    const token = this.peek();

    if (!token || token.type !== type) {
      return false;
    }

    this.index += 1;
    return true;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private consume(): Token | undefined {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const character = input[index];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    const twoCharacterOperator = input.slice(index, index + 2);

    if ([">=", "<=", "==", "!=", "&&", "||"].includes(twoCharacterOperator)) {
      tokens.push({ type: "operator", value: twoCharacterOperator });
      index += 2;
      continue;
    }

    if (["+", "-", "*", "/", ">", "<", "!"].includes(character)) {
      tokens.push({ type: "operator", value: character });
      index += 1;
      continue;
    }

    if (character === "(") {
      tokens.push({ type: "paren", value: "(" });
      index += 1;
      continue;
    }

    if (character === ")") {
      tokens.push({ type: "paren", value: ")" });
      index += 1;
      continue;
    }

    if (character === "?") {
      tokens.push({ type: "question" });
      index += 1;
      continue;
    }

    if (character === ":") {
      tokens.push({ type: "colon" });
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      const { value, nextIndex } = readQuotedString(input, index, character);
      tokens.push({ type: "string", value });
      index = nextIndex;
      continue;
    }

    if (character === "{") {
      const closingIndex = input.indexOf("}", index + 1);

      if (closingIndex === -1) {
        throw new TransformExecutionError("Calculated field expression is missing a closing brace for a field reference.");
      }

      const fieldName = input.slice(index + 1, closingIndex).trim();

      if (!fieldName) {
        throw new TransformExecutionError("Calculated field expression contains an empty field reference.");
      }

      tokens.push({ type: "field", value: fieldName });
      index = closingIndex + 1;
      continue;
    }

    if (/\d/.test(character) || (character === "." && /\d/.test(input[index + 1] ?? ""))) {
      const match = input.slice(index).match(/^(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?/);

      if (!match) {
        throw new TransformExecutionError("Calculated field expression contains an invalid numeric literal.");
      }

      tokens.push({ type: "number", value: Number(match[0]) });
      index += match[0].length;
      continue;
    }

    const identifierMatch = input.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);

    if (identifierMatch) {
      const identifier = identifierMatch[0];

      if (identifier === "true" || identifier === "false") {
        tokens.push({ type: "boolean", value: identifier === "true" });
      } else if (identifier === "null") {
        tokens.push({ type: "null" });
      } else {
        throw new TransformExecutionError(
          `Calculated field expression contains unsupported identifier \"${identifier}\". Use {fieldName} for field references.`,
        );
      }

      index += identifier.length;
      continue;
    }

    throw new TransformExecutionError(`Calculated field expression contains an unexpected character: ${character}`);
  }

  return tokens;
}

function readQuotedString(input: string, startIndex: number, quoteCharacter: string): { value: string; nextIndex: number } {
  let value = "";
  let index = startIndex + 1;

  while (index < input.length) {
    const character = input[index];

    if (character === "\\") {
      const nextCharacter = input[index + 1];

      if (!nextCharacter) {
        throw new TransformExecutionError("Calculated field expression contains an unfinished escape sequence.");
      }

      value += nextCharacter;
      index += 2;
      continue;
    }

    if (character === quoteCharacter) {
      return {
        value,
        nextIndex: index + 1,
      };
    }

    value += character;
    index += 1;
  }

  throw new TransformExecutionError("Calculated field expression is missing a closing quote.");
}

function evaluateNode(node: ExpressionNode, row: DatasetRow): DatasetScalar {
  switch (node.type) {
    case "literal":
      return node.value;
    case "field":
      return row[node.name] ?? null;
    case "unary": {
      const argument = evaluateNode(node.argument, row);

      if (node.operator === "!") {
        return !toBoolean(argument);
      }

      return toNumber(argument) === null ? null : -toNumber(argument)!;
    }
    case "binary":
      return evaluateBinary(node.operator, evaluateNode(node.left, row), evaluateNode(node.right, row));
    case "conditional":
      return toBoolean(evaluateNode(node.test, row))
        ? evaluateNode(node.consequent, row)
        : evaluateNode(node.alternate, row);
  }
}

function evaluateBinary(operator: string, left: DatasetScalar, right: DatasetScalar): DatasetScalar {
  switch (operator) {
    case "+":
      if (typeof left === "string" || typeof right === "string") {
        return `${stringifyScalar(left)}${stringifyScalar(right)}`;
      }
      return operateNumbers(left, right, (a, b) => a + b);
    case "-":
      return operateNumbers(left, right, (a, b) => a - b);
    case "*":
      return operateNumbers(left, right, (a, b) => a * b);
    case "/": {
      const leftNumber = toNumber(left);
      const rightNumber = toNumber(right);

      if (leftNumber === null || rightNumber === null || rightNumber === 0) {
        return null;
      }

      return leftNumber / rightNumber;
    }
    case ">":
      return compareScalars(left, right, (a, b) => a > b);
    case ">=":
      return compareScalars(left, right, (a, b) => a >= b);
    case "<":
      return compareScalars(left, right, (a, b) => a < b);
    case "<=":
      return compareScalars(left, right, (a, b) => a <= b);
    case "==":
      return isEqual(left, right);
    case "!=":
      return !isEqual(left, right);
    case "&&":
      return toBoolean(left) && toBoolean(right);
    case "||":
      return toBoolean(left) || toBoolean(right);
    default:
      throw new TransformExecutionError(`Unsupported calculated field operator: ${operator}`);
  }
}

function operateNumbers(
  left: DatasetScalar,
  right: DatasetScalar,
  operation: (left: number, right: number) => number,
): DatasetScalar {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);

  if (leftNumber === null || rightNumber === null) {
    return null;
  }

  return operation(leftNumber, rightNumber);
}

function compareScalars(
  left: DatasetScalar,
  right: DatasetScalar,
  comparison: (left: number | string, right: number | string) => boolean,
): DatasetScalar {
  if (typeof left === "number" && typeof right === "number") {
    return comparison(left, right);
  }

  if (typeof left === "string" && typeof right === "string") {
    return comparison(left, right);
  }

  return false;
}

function toNumber(value: DatasetScalar): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBoolean(value: DatasetScalar): boolean {
  if (value === null) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return value.length > 0;
}

function stringifyScalar(value: DatasetScalar): string {
  if (value === null) {
    return "";
  }

  return String(value);
}

function isEqual(left: DatasetScalar, right: DatasetScalar): boolean {
  return left === right;
}
