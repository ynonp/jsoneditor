#!/bin/bash -e

bg=$(echo "url(data:image/svg+xml;base64,$(cat src/scss/img/jsoneditor-icons.svg | base64 | tr -d '\r\n'))")
scssfile=./src/scss/jsoneditor/_variables.scss

sed  -i -e '/\$jse-icons: ".\/img\/jsoneditor-icons.svg" !default;/d' $scssfile
sed  -i -e '/\$jse-icons-url: url(\$jse-icons) !default;/d' $scssfile
echo '$jse-icons-url: '"$bg" >> $scssfile

