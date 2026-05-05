// SPDX-License-Identifier: Apache-2.0
//
// Shared renderer for authoring-time `{{generated:...}}` Markdown template
// directives. Shipped `<!-- BEGIN:... -->` markers are handled elsewhere.

export type TemplateDirectiveRenderer = (problems: string[]) => string | null;

interface TemplateRenderResult {
  content: string;
  problems: string[];
  usageCounts: Map<string, number>;
}

interface TemplateDirectiveMessages {
  templatePath: string;
  directiveLabel?: string;
}

export function renderTemplateDirectives(input: {
  templateContent: string;
  directives: Record<string, TemplateDirectiveRenderer>;
  requiredDirectives: readonly string[];
  messages: TemplateDirectiveMessages;
}): TemplateRenderResult {
  const usageCounts = new Map<string, number>();
  const problems: string[] = [];
  const directivePattern = /{{\s*([^{}]+?)\s*}}/g;
  let expectedUnresolvedMarker = false;
  const content = input.templateContent.replace(directivePattern, (marker, directive: string) => {
    const directiveName = directive.trim();
    const renderDirective = input.directives[directiveName];
    if (!renderDirective) {
      expectedUnresolvedMarker = true;
      problems.push(unknownDirectiveMessage(input.messages, directiveName));
      return marker;
    }

    usageCounts.set(directiveName, (usageCounts.get(directiveName) ?? 0) + 1);
    const rendered = renderDirective(problems);
    if (rendered === null) expectedUnresolvedMarker = true;
    return rendered ?? marker;
  });

  for (const directiveName of input.requiredDirectives) {
    const count = usageCounts.get(directiveName) ?? 0;
    if (count === 0) {
      problems.push(missingDirectiveMessage(input.messages, directiveName));
    } else if (count > 1) {
      problems.push(duplicateDirectiveMessage(input.messages, directiveName, count));
    }
  }

  if (!expectedUnresolvedMarker && /{{\s*([^{}]+?)\s*}}/.test(content)) {
    problems.push(unresolvedDirectivesMessage(input.messages));
  }

  return {
    content: ensureTrailingNewline(content),
    problems,
    usageCounts,
  };
}

function missingDirectiveMessage(
  messages: TemplateDirectiveMessages,
  directiveName: string,
): string {
  return `${messages.templatePath} is missing ${directiveLabel(messages)} {{${directiveName}}}.`;
}

function duplicateDirectiveMessage(
  messages: TemplateDirectiveMessages,
  directiveName: string,
  count: number,
): string {
  return `${messages.templatePath} contains ${count} ${directiveLabel(messages)}s for {{${directiveName}}}.`;
}

function unknownDirectiveMessage(
  messages: TemplateDirectiveMessages,
  directiveName: string,
): string {
  return `${messages.templatePath} contains unknown ${directiveLabel(messages)} {{${directiveName}}}.`;
}

function unresolvedDirectivesMessage(messages: TemplateDirectiveMessages): string {
  return `${messages.templatePath} rendered output still contains unresolved template directives.`;
}

function directiveLabel(messages: TemplateDirectiveMessages): string {
  return messages.directiveLabel ?? 'template directive';
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}
