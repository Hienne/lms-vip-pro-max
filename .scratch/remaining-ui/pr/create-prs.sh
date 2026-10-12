#!/usr/bin/env bash
# Opens the 12 PRs in order. Needs `gh auth login` first. PR 11 is stacked on PR 10.
set -euo pipefail
cd "$(dirname "$0")/../../.."
gh pr create --base main --head feat/ui-search --title "Add ui-search molecule" --body-file .scratch/remaining-ui/pr/01-ui-search.md
gh pr create --base main --head feat/ui-tabs --title "Add ui-tabs molecule on @angular/aria" --body-file .scratch/remaining-ui/pr/02-ui-tabs.md
gh pr create --base main --head feat/ui-rating --title "Add ui-stars and ui-rating molecules" --body-file .scratch/remaining-ui/pr/03-ui-rating.md
gh pr create --base main --head feat/ui-kpi --title "Add ui-kpi molecule" --body-file .scratch/remaining-ui/pr/04-ui-kpi.md
gh pr create --base main --head feat/ui-option-card --title "Add ui-option-card molecule with review rows" --body-file .scratch/remaining-ui/pr/05-ui-option-card.md
gh pr create --base main --head feat/ui-upload --title "Add uiDropzone and ui-upload-item" --body-file .scratch/remaining-ui/pr/06-ui-upload.md
gh pr create --base main --head feat/ui-stepper --title "Add ui-stepper organism on the CDK stepper" --body-file .scratch/remaining-ui/pr/07-ui-stepper.md
gh pr create --base main --head feat/ui-tree --title "Add ui-tree organism on @angular/aria tree" --body-file .scratch/remaining-ui/pr/08-ui-tree.md
gh pr create --base main --head feat/ui-sortable --title "Add sortable list molecule on CDK drag-drop" --body-file .scratch/remaining-ui/pr/09-ui-sortable.md
gh pr create --base main --head feat/domain-status-badges --title "Add CourseStatusSchema and the four domain status badges" --body-file .scratch/remaining-ui/pr/10-domain-status-badges.md
gh pr create --base feat/domain-status-badges --head feat/course-card-family --title "Add course card, journey, due date and required mark" --body-file .scratch/remaining-ui/pr/11-course-card-family.md
gh pr create --base main --head feat/quiz-parts --title "Add ui-timer, question grid and legend" --body-file .scratch/remaining-ui/pr/12-quiz-parts.md
echo "Done. After merging #10, run: gh pr edit feat/course-card-family --base main"
