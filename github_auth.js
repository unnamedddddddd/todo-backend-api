export const exchangeCodeForToken = async (code) => {
  const response = await fetch('https://github.com/login/oauth/access_token',{
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Accept': 'application/json'
    },
    body: JSON.stringify({ 
      code,
      ClIENT_ID_GITHUB: process.env.ClIENT_ID_GITHUB,
      CLIENT_SECRET_GITHUB: process.env.CLIENT_SECRET_GITHUB,
    })
  })

  const tokenGitHub = await response.json();

  if (tokenGitHub.error) {
    throw new Error(`GitHub Auth error: ${tokenData.error_description} `);
  }
  
  return tokenGitHub;
}

export const getUserInfoFromGithub = async (tokenGitHub) => {
  const response = await fetch('https://api.github.com/user', {
     headers: {
      'Authorization': `Bearer ${tokenGitHub}`,
      'Accept': 'application/json',
    },
  })

  return response.json();
}