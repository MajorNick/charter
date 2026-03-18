import { DatasetField } from "../dataset";
import { TransformStep } from "../template-contract";

export function projectTransformedFields(sourceFields: DatasetField[], transforms: TransformStep[]): DatasetField[] {
  let fields = sourceFields.map(cloneField);

  transforms.forEach((step) => {
    switch (step.type) {
      case "filter":
      case "sort":
        break;
      case "calculate": {
        if (!step.outputField.trim()) {
          break;
        }

        const nextField = createSyntheticField(step.outputField, step.outputKind);
        const existingIndex = fields.findIndex((field) => field.key === step.outputField);

        if (existingIndex >= 0) {
          fields = fields.map((field, index) => index === existingIndex ? nextField : field);
        } else {
          fields = [...fields, nextField];
        }
        break;
      }
      case "group": {
        const groupedFields = step.groupBy
          .map((fieldKey) => fields.find((field) => field.key === fieldKey))
          .filter((field): field is DatasetField => Boolean(field))
          .map(cloneField);
        const aggregateFields = step.aggregates
          .filter((aggregate) => aggregate.as.trim().length > 0)
          .map((aggregate) => createSyntheticField(aggregate.as, "number"));
        fields = dedupeFieldsByKey([...groupedFields, ...aggregateFields]);
        break;
      }
      case "select": {
        const selected = new Set(step.fields);
        fields = fields.filter((field) => selected.has(field.key));
        break;
      }
      case "rename": {
        const renameMap = new Map(step.mappings.filter((mapping) => mapping.to.trim().length > 0).map((mapping) => [mapping.from, mapping.to]));
        fields = dedupeFieldsByKey(fields.map((field) => {
          const nextKey = renameMap.get(field.key);
          if (!nextKey) {
            return field;
          }

          return {
            ...field,
            key: nextKey,
            label: nextKey,
            sourceKey: nextKey,
          };
        }));
        break;
      }
    }
  });

  return fields;
}

function createSyntheticField(key: string, kind: DatasetField["kind"]): DatasetField {
  return {
    key,
    label: key,
    sourceKey: key,
    kind,
    nullable: true,
    valuesPresent: 0,
    sampleValues: [],
  };
}

function cloneField(field: DatasetField): DatasetField {
  return {
    ...field,
    sampleValues: [...field.sampleValues],
  };
}

function dedupeFieldsByKey(fields: DatasetField[]): DatasetField[] {
  const seen = new Set<string>();
  const result: DatasetField[] = [];

  fields.forEach((field) => {
    if (seen.has(field.key)) {
      return;
    }

    seen.add(field.key);
    result.push(field);
  });

  return result;
}
