import { DynamoDB } from "aws-sdk";
import { APIGatewayProxyHandler } from "aws-lambda";

const ddb = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";

export const handler: APIGatewayProxyHandler = async (event) => {
    const { role, movieId } = event.pathParameters || {};
    const name = event.queryStringParameters?.name;
  
    if (!role || !movieId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required parameters." }),
      };
    }

  try {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "movieId = :movieId and crewRole = :crewRole",
      ExpressionAttributeValues: {
        ":movieId": parseInt(movieId, 10),
        ":crewRole": role,
      },
    };

    const result = await ddb.query(params).promise();

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: `No crew members found for role '${role}' in movie '${movieId}'.`,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        crew: result.Items,
      }),
    };
  } catch (error) {
    console.error("Error fetching data:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred while fetching data.",
        error: error.message,
      }),
    };
  }
};
