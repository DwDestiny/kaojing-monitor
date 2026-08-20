import { getSubjects } from "../../api/src/index.js";

export const onRequestGet = async (context) => getSubjects(context.env);
