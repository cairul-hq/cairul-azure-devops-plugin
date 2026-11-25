import { Buffer } from 'node:buffer';
import {
  bearer,
  connection,
  error,
  matchesState,
  resourceCheck,
  segment,
  stateOption,
  fromPath,
  workURL,
  text,
  verdict,
} from '@cairul/plugin-kit';

export default function azureDevOps(options) {
  const api = connection(options, {
    prefix: 'AZURE_DEVOPS',
    baseUrl: 'https://dev.azure.com',
    tokenEnv: (mode) => (mode === 'pat' ? 'AZURE_DEVOPS_PAT' : 'AZURE_DEVOPS_ACCESS_TOKEN'),
    required: true,
    authModes: { pat: (token) => ({ authorization: 'Basic ' + Buffer.from(':' + token).toString('base64') }), bearer },
  });
  if (!api.workspace) throw new Error('Set plugin options.workspace to the Azure DevOps organization.');
  const workItem = (shape, evaluate) =>
    resourceCheck({
      api,
      identifier: 'workItem',
      parseURL: (url) => {
        const [organization, id] = fromPath(
          workURL(url, [api.host]),
          /^\/([^/]+)\/.*\/_workitems\/edit\/(\d+)(?:\/|$)/i
        );
        if (organization.toLowerCase() !== api.workspace.toLowerCase())
          throw new Error('Work item belongs to a different Azure DevOps organization.');
        return id;
      },
      path: (id) => `${segment(api.workspace)}/_apis/wit/workitems/${segment(id)}`,
      query: { 'api-version': '7.1' },
      shape,
      evaluate: ({ fields }, inputs) =>
        fields ? evaluate(fields, inputs) : error('Azure DevOps returned no work item fields.'),
    });
  return {
    checkKinds: {
      'azure-devops.work-item-state': workItem({ state: stateOption }, (fields, { state }) =>
        matchesState(fields['System.State'], state, 'Work item')
      ),
      'azure-devops.work-item-field-present': workItem({ field: text }, (fields, { field }) =>
        verdict(
          Object.hasOwn(fields, field) && fields[field] != null && fields[field] !== '',
          `Waiting for field "${field}".`
        )
      ),
    },
  };
}
