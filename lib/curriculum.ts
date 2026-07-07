import type { Curriculum, CurriculumTopic } from "@/lib/schemas";

export interface TopicContext {
  topic: CurriculumTopic;
  moduleTitle: string;
  moduleKey: string;
  levelTitle: string;
  levelIdx: number;
}

/** Locate a topic (with its module/level context) inside a curriculum structure. */
export function findTopic(
  structure: Curriculum,
  topicKey: string
): TopicContext | null {
  for (let levelIdx = 0; levelIdx < structure.levels.length; levelIdx++) {
    const level = structure.levels[levelIdx];
    for (const mod of level.modules) {
      const topic = mod.topics.find((t) => t.key === topicKey);
      if (topic) {
        return {
          topic,
          moduleTitle: mod.title,
          moduleKey: mod.key,
          levelTitle: level.title,
          levelIdx,
        };
      }
    }
  }
  return null;
}
