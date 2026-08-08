import type { Student } from "@/lib/types/students";

/** Mock class roster of 20 students (demo data). */
export const MOCK_STUDENTS: Student[] = [
  { id: "stu-01", rollNo: 1, name: "Aarav Sharma", grade: "8", parentName: "Rajesh Sharma" },
  { id: "stu-02", rollNo: 2, name: "Ananya Patel", grade: "8", parentName: "Meena Patel" },
  { id: "stu-03", rollNo: 3, name: "Arjun Mehta", grade: "8", parentName: "Suresh Mehta" },
  { id: "stu-04", rollNo: 4, name: "Diya Reddy", grade: "8", parentName: "Lakshmi Reddy" },
  { id: "stu-05", rollNo: 5, name: "Ishaan Kapoor", grade: "8", parentName: "Vikram Kapoor" },
  { id: "stu-06", rollNo: 6, name: "Kavya Iyer", grade: "8", parentName: "Priya Iyer" },
  { id: "stu-07", rollNo: 7, name: "Krishna Nair", grade: "8", parentName: "Anil Nair" },
  { id: "stu-08", rollNo: 8, name: "Meera Joshi", grade: "8", parentName: "Sunita Joshi" },
  { id: "stu-09", rollNo: 9, name: "Neha Gupta", grade: "8", parentName: "Amit Gupta" },
  { id: "stu-10", rollNo: 10, name: "Omkar Desai", grade: "8", parentName: "Nisha Desai" },
  { id: "stu-11", rollNo: 11, name: "Priya Singh", grade: "8", parentName: "Harpreet Singh" },
  { id: "stu-12", rollNo: 12, name: "Rahul Verma", grade: "8", parentName: "Deepak Verma" },
  { id: "stu-13", rollNo: 13, name: "Riya Banerjee", grade: "8", parentName: "Sourav Banerjee" },
  { id: "stu-14", rollNo: 14, name: "Saanvi Rao", grade: "8", parentName: "Kavitha Rao" },
  { id: "stu-15", rollNo: 15, name: "Siddharth Malhotra", grade: "8", parentName: "Rohit Malhotra" },
  { id: "stu-16", rollNo: 16, name: "Tanvi Choudhary", grade: "8", parentName: "Pooja Choudhary" },
  { id: "stu-17", rollNo: 17, name: "Vihaan Agarwal", grade: "8", parentName: "Manish Agarwal" },
  { id: "stu-18", rollNo: 18, name: "Yash Chopra", grade: "8", parentName: "Karan Chopra" },
  { id: "stu-19", rollNo: 19, name: "Zara Khan", grade: "8", parentName: "Imran Khan" },
  { id: "stu-20", rollNo: 20, name: "Aditi Pillai", grade: "8", parentName: "Ravi Pillai" },
];

export function getStudentById(id: string): Student | undefined {
  return MOCK_STUDENTS.find((s) => s.id === id);
}
