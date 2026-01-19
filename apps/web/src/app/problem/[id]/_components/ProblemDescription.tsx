import { Text } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRemarkSync } from 'react-remark';
import React from "react";

function ProblemDescription() {
  const problemDescription = `
# Reverse a String

## Problem Statement
Write a function that takes a string as input and returns the string reversed.

## Input
- A single string s with length 1 ≤ |s| ≤ 10^5.

## Output
- The reversed string.

## Examples
### Example 1
**Input:**  

hello

**Output:**  

olleh


### Example 2
**Input:**  

OpenAI
**Output:** 
IAnepO

## Constraints
- You cannot use built-in functions like reverse() or slicing tricks.
- The function should run in O(n) time complexity.

## Function Signature (Python)
def reverse_string(s: str) -> str:
    pass  # Implement this function

## Notes
- Consider using a loop or stack to reverse the string.
- Think about edge cases such as an empty string or a string with one character.
`;
  const reactContent = useRemarkSync(problemDescription);

  return (
    <Card className="bg-[#1a1f2e] text-white flex flex-col h-full">
      <CardHeader>
        <CardTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center rounded-lg bg-[#1e1e2e] ring-1 ring-gray-800/50">
                <Text className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-gray-300">Problem Description</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full h-[60vh]">
          <div
            className="prose prose-sm prose-invert"
          >
            {reactContent}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default ProblemDescription;
