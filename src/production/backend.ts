import type {MonitoringBackend,MonitoringProfile,Topic,Source,SourceRecord,Update,AppState} from '../domain/monitoring';
import {stateStore} from '../platform/storage';
import {api} from './api';
async function mutate<T>(path:string,method:string,data?:unknown){const result=await api<T>(path,method,data);await stateStore.refresh();return result;}
export const monitoringBackend:MonitoringBackend={
 suggestTopics:input=>api<Topic[]>('topics','POST',{input}),
 suggestSources:async()=>api<Source[]>('sources'),
 addCanton:canton=>api<Source[]>(`sources/cantons/${encodeURIComponent(canton)}`),
 createProfile:async profile=>{const p=await mutate<MonitoringProfile>('profiles','POST',profile);stateStore.write({...stateStore.read(),draft:null});void api(`profiles/${p.id}/monitor`,'POST',{}).then(()=>stateStore.refresh()).catch(()=>{});return p;},
 updateProfile:profile=>mutate<MonitoringProfile>(`profiles/${profile.id}`,'PUT',profile),
 getProfiles:async()=>structuredClone(stateStore.read().profiles),
 getUpdates:async profileId=>structuredClone(stateStore.read().updates.filter(u=>u.profile_id===profileId)),
 getUpdate:async id=>api<Update>(`updates/${id}`),
 saveUpdate:async(id,saved)=>{await mutate(`updates/${id}`,'PATCH',{saved});},
 addNote:async(id,note)=>{await mutate(`updates/${id}`,'PATCH',{note});},
 submitFeedback:async(id,feedback,reason)=>{await mutate(`updates/${id}`,'PATCH',{feedback,feedback_reason:reason});},
 markRead:async id=>{if(!stateStore.read().updates.find(u=>u.id===id)?.read)await mutate(`updates/${id}`,'PATCH',{read:true});},
 getSourceRecord:id=>api<SourceRecord>(`updates/${id}/source`),
 getDeliveryPreview:profile=>api<Update|null>('preview','POST',{profile}),
 deleteProfile:async(id,confirmation)=>{await mutate(`profiles/${id}`,'DELETE',{confirmation});},
 duplicateProfile:id=>mutate<MonitoringProfile>(`profiles/${id}/duplicate`,'POST',{}),
};
export async function exportAccount(){return api<AppState>('account/export');}
