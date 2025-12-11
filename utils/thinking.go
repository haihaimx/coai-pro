package utils

import (
	"chat/globals"
	"fmt"
	"regexp"
	"strings"
)

var thinkingDirectivePattern = regexp.MustCompile(`(?i)/(?:no[_-]?think|think)\b`)

func ExtractThinkingDirective(content string) (string, *bool) {
	if len(content) == 0 {
		return content, nil
	}

	var directive *bool
	sanitized := thinkingDirectivePattern.ReplaceAllStringFunc(content, func(match string) string {
		normalized := strings.ToLower(match)
		value := true
		if strings.Contains(normalized, "no") {
			value = false
		}
		directive = ToPtr(value)
		return ""
	})

	return strings.TrimSpace(sanitized), directive
}

func ExtractThinkingDirectiveFromMessages(messages []globals.Message) ([]globals.Message, *bool) {
	var directive *bool
	for idx := range messages {
		content, pointer := ExtractThinkingDirective(messages[idx].Content)
		if pointer != nil {
			directive = pointer
		}
		messages[idx].Content = content
	}

	return messages, directive
}

func ApplyThinkingDirective(messages []globals.Message, directive *bool) []globals.Message {
	if directive == nil || len(messages) == 0 {
		return messages
	}

	target := -1
	for idx := len(messages) - 1; idx >= 0; idx-- {
		role := messages[idx].Role
		if role == globals.User || role == globals.System {
			target = idx
			break
		}
	}

	if target == -1 {
		return messages
	}

	token := "/think"
	if !*directive {
		token = "/no_think"
	}

	content := strings.TrimSpace(messages[target].Content)
	if content == "" {
		messages[target].Content = token
	} else {
		messages[target].Content = fmt.Sprintf("%s\n%s", content, token)
	}

	return messages
}
