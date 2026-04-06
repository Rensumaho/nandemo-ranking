export function facultyLabel(facultyType: "science" | "humanities" | "medicine") {
  switch (facultyType) {
    case "science":
      return "理系";
    case "humanities":
      return "文系";
    case "medicine":
      return "医学部";
    default:
      return facultyType;
  }
}

export function universityKindLabel(kind: "national" | "public" | "private") {
  switch (kind) {
    case "national":
      return "国立";
    case "public":
      return "公立";
    case "private":
      return "私立";
    default:
      return kind;
  }
}

export function requestStatusLabel(status: "pending" | "applied" | "rejected") {
  switch (status) {
    case "pending":
      return "判定待ち";
    case "applied":
      return "反映済み";
    case "rejected":
      return "不採用";
    default:
      return status;
  }
}

