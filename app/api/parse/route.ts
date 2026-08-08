import { NextRequest, NextResponse } from "next/server";

import {
  ParseFileError,
  parseQuestionFile,
  parseTemplateFile,
} from "@/lib/parse-file";

// NOTE: This route only parses uploaded files — it never calls Groq.
// All AI generation happens exclusively in /api/generate.

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function errorStatus(code: ParseFileError["code"]): number {
  switch (code) {
    case "UNSUPPORTED":
    case "INVALID":
      return 400;
    case "EMPTY":
      return 422;
    case "CORRUPTED":
      return 422;
    default:
      return 500;
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          error:
            "Invalid request. Expected multipart/form-data with a file upload.",
          code: "INVALID",
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No question file provided.", code: "INVALID" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The uploaded file is empty.", code: "EMPTY" },
        { status: 422 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
          code: "INVALID",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseQuestionFile(buffer, file.name);

    let templateContent: string | null = null;
    const template = formData.get("template");

    if (template instanceof File && template.size > 0) {
      const templateBuffer = Buffer.from(await template.arrayBuffer());
      templateContent = await parseTemplateFile(
        templateBuffer,
        template.name
      );
    }

    if (parsed.dataType === "text") {
      return NextResponse.json({
        success: true,
        fileName: file.name,
        format: parsed.format,
        dataType: "text",
        text: parsed.text,
        questionCount: null,
        templateContent,
      });
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      format: parsed.format,
      dataType: "structured",
      questions: parsed.questions,
      sheetNames: parsed.sheetNames,
      questionCount: parsed.questions.length,
      templateContent,
    });
  } catch (error) {
    console.error("Parse error:", error);

    if (error instanceof ParseFileError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: errorStatus(error.code) }
      );
    }

    return NextResponse.json(
      {
        error: "An unexpected error occurred while parsing the file.",
        code: "CORRUPTED",
      },
      { status: 500 }
    );
  }
}
