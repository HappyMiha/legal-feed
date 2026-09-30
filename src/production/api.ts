export async function api<T>(path:string,method='GET',data?:unknown):Promise<T>{
 const response=await fetch(`/api/${path}`,{method,credentials:'same-origin',headers:data===undefined?{}:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
 if(response.status===401){location.assign(`/signin-with-chatgpt?return_to=${encodeURIComponent(location.pathname+location.search)}`);throw Error('Sign in to continue.');}
 const result=await response.json();if(!response.ok)throw Error((result as {error?:string}).error||'Request failed.');return result as T;
}
